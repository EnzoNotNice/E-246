const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const config = require('../config');
const logger = require('./logger');

const BACKUP_DIR = path.join(__dirname, '../backups');

function getFormattedDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    if (!db.client) {
      logger.error('[Backup] Database client not ready. Skipping backup.');
      return;
    }

    const mongoDb = db.client.db();
    const collections = await mongoDb.collections();

    const backupData = {};
    for (const col of collections) {
      const colName = col.collectionName;
      if (colName.startsWith('system.')) continue;

      const docs = await col.find({}).toArray();
      backupData[colName] = docs;
    }

    const backupFile = path.join(BACKUP_DIR, `db_backup_${getFormattedDate()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    logger.info(`[Backup] Database backup completed successfully: ${backupFile}`);

    if (process.env.BACKUP_WEBHOOK_URL) {
      try {
        const formData = new FormData();
        const fileContent = fs.readFileSync(backupFile);
        formData.append('files[0]', new Blob([fileContent]), path.basename(backupFile));
        formData.append(
          'payload_json',
          JSON.stringify({
            content: `📦 **نسخة احتياطية جديدة لقاعدة البيانات**\nالتاريخ: \`${getFormattedDate()}\`\nالملف: \`${path.basename(backupFile)}\``
          })
        );

        const res = await fetch(process.env.BACKUP_WEBHOOK_URL, {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          logger.info('[Backup] Webhook backup successfully uploaded to Discord.');
        } else {
          logger.error('[Backup] Webhook backup failed with status:', res.status);
        }
      } catch (webhookErr) {
        logger.error('[Backup] Failed to send database backup via webhook:', webhookErr.message || webhookErr);
      }
    }

    pruneOldBackups();
  } catch (err) {
    logger.error('[Backup] Database backup failed:', err);
  }
}

function pruneOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db_backup_') && f.endsWith('.json'));

    files.sort((a, b) => {
      const dateA = a.replace('db_backup_', '').replace('.json', '');
      const dateB = b.replace('db_backup_', '').replace('.json', '');
      return dateA.localeCompare(dateB);
    });

    const retentionCount = config.backup.retentionDays || 7;
    if (files.length > retentionCount) {
      const toDelete = files.slice(0, files.length - retentionCount);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        logger.info(`[Backup] Deleted old backup file: ${file}`);
      }
    }
  } catch (err) {
    logger.error('[Backup] Pruning old backups failed:', err);
  }
}

function initBackupScheduler() {
  if (config.backup.enabled === false) {
    logger.info('[Backup] Database backup scheduler is disabled in config.js.');
    return;
  }

  // Run first backup immediately on startup (wait 10 seconds for DB connection to establish)
  setTimeout(() => {
    runBackup();
  }, 10000);

  // Then run backup according to config interval (default 24h)
  setInterval(
    () => {
      runBackup();
    },
    config.backup.intervalMs || 24 * 60 * 60 * 1000
  );
}

module.exports = {
  initBackupScheduler,
  runBackup
};
