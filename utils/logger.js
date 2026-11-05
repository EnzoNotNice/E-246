const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      const msg = typeof message === 'string' ? message : JSON.stringify(message);
      return `[${timestamp}] [${level.toUpperCase()}]: ${stack || msg}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.printf(({ level, message, timestamp, stack }) => {
          const msg = typeof message === 'string' ? message : JSON.stringify(message);
          return `[${timestamp}] [${level.toUpperCase()}]: ${stack || msg}`;
        })
      )
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

let dbInstance = null;
function setDb(db) {
  dbInstance = db;
}

async function sendLog(client, guildId, embedOrPayload, eventType) {
  try {
    if (!client || !guildId) return;
    let db = dbInstance;
    if (!db) {
      try {
        const dbPath = '../database/db';
        db = require(dbPath);
      } catch {
        db = null;
      }
    }

    const logSettings = db && db.getLogSettings ? db.getLogSettings(guildId) : null;
    const guildSettings = db && db.getGuildSettings ? db.getGuildSettings(guildId) : null;
    const mainLogChannel = guildSettings?.log_channel || null;

    let targetChannelId = null;
    if (logSettings) {
      const column = `${eventType}_channel`;
      targetChannelId = logSettings[column] || mainLogChannel;
    } else {
      targetChannelId = mainLogChannel;
    }

    if (!targetChannelId) return;
    const channel =
      client.channels.cache.get(targetChannelId) || (await client.channels.fetch(targetChannelId).catch(() => null));
    if (!channel) return;

    const payload = embedOrPayload && embedOrPayload.embeds ? embedOrPayload : { embeds: [embedOrPayload] };
    await channel.send(payload).catch(() => null);
  } catch (err) {
    logger.error(`Error in sendLog (${eventType}): ${err.message}`);
  }
}

module.exports = logger;
module.exports.logger = logger;
module.exports.sendLog = sendLog;
module.exports.setDb = setDb;
