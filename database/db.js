const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'bot.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

try {
  const tableInfo = db.prepare("PRAGMA table_info(log_settings)").all();
  const banCol = tableInfo.find(c => c.name === 'ban');
  if (banCol && banCol.type === 'INTEGER') {
    console.log('[DB] Migrating log_settings table to new schema...');
    db.exec("DROP TABLE IF EXISTS log_settings");
  }
} catch (e) {}

try { db.exec("ALTER TABLE guild_settings ADD COLUMN line_image TEXT"); } catch (e) {}

try {
  db.exec("ALTER TABLE ticket_settings ADD COLUMN panel_data TEXT DEFAULT '{}'");
} catch (e) {}

try { db.exec("ALTER TABLE protection_settings ADD COLUMN antilink INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE protection_settings ADD COLUMN antispam INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE protection_settings ADD COLUMN antiraid INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE levels ADD COLUMN reactionsCount INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE reactroles ADD COLUMN guildId TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE protection_settings ADD COLUMN bypass_role TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE guild_settings ADD COLUMN autoboost_channel TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE guild_settings ADD COLUMN autoboost_message TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE tempvoice_settings ADD COLUMN panel_channel TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE guild_settings ADD COLUMN reply_type TEXT DEFAULT 'embed'"); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guildId TEXT PRIMARY KEY,
    prefix TEXT DEFAULT '#',
    giveaway_emoji TEXT DEFAULT '🎉',
    log_channel TEXT,
    setlog_channel TEXT,
    line_image TEXT,
    autoboost_channel TEXT,
    autoboost_message TEXT,
    reply_type TEXT DEFAULT 'embed'
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    reason TEXT,
    moderatorId TEXT,
    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS levels (
    userId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    voice_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    voice_level INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    last_message INTEGER DEFAULT 0,
    reactionsCount INTEGER DEFAULT 0,
    PRIMARY KEY (userId, guildId)
  );

  CREATE TABLE IF NOT EXISTS level_settings (
    guildId TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,
    channel TEXT,
    xp_min INTEGER DEFAULT 15,
    xp_max INTEGER DEFAULT 25,
    xp_cooldown INTEGER DEFAULT 60,
    role_rewards TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS greet_settings (
    guildId TEXT PRIMARY KEY,
    channel TEXT,
    message TEXT DEFAULT 'Welcome {user} to {server}!',
    dm_message TEXT,
    delete_after INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 0,
    image_url TEXT,
    avatar_x INTEGER DEFAULT 100,
    avatar_y INTEGER DEFAULT 100,
    avatar_size INTEGER DEFAULT 150,
    username_x INTEGER DEFAULT 100,
    username_y INTEGER DEFAULT 300,
    username_color TEXT DEFAULT '#ffffff',
    username_size INTEGER DEFAULT 40
  );

  CREATE TABLE IF NOT EXISTS automation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    channelId TEXT NOT NULL,
    type TEXT NOT NULL,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    messageId TEXT PRIMARY KEY,
    channelId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners INTEGER DEFAULT 1,
    host TEXT,
    endTime INTEGER NOT NULL,
    emoji TEXT DEFAULT '🎉',
    ended INTEGER DEFAULT 0,
    paused INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS protection_settings (
    guildId TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    antilink INTEGER DEFAULT 0,
    antispam INTEGER DEFAULT 0,
    antiraid INTEGER DEFAULT 0,
    bypass_role TEXT,
    ban_limit INTEGER DEFAULT 3,
    kick_limit INTEGER DEFAULT 3,
    channel_limit INTEGER DEFAULT 3,
    role_limit INTEGER DEFAULT 3,
    webhook_limit INTEGER DEFAULT 3,
    action TEXT DEFAULT 'ban'
  );

  CREATE TABLE IF NOT EXISTS whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    targetId TEXT NOT NULL,
    type TEXT DEFAULT 'user',
    UNIQUE(guildId, targetId, type)
  );

  CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    targetId TEXT NOT NULL,
    type TEXT DEFAULT 'user',
    UNIQUE(guildId, targetId, type)
  );

  CREATE TABLE IF NOT EXISTS invites (
    userId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    fake INTEGER DEFAULT 0,
    left INTEGER DEFAULT 0,
    bonus INTEGER DEFAULT 0,
    PRIMARY KEY (userId, guildId)
  );

  CREATE TABLE IF NOT EXISTS invite_uses (
    code TEXT NOT NULL,
    guildId TEXT NOT NULL,
    inviterId TEXT,
    uses INTEGER DEFAULT 0,
    PRIMARY KEY (code, guildId)
  );

  CREATE TABLE IF NOT EXISTS invite_ranks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    count INTEGER NOT NULL,
    roleId TEXT NOT NULL,
    UNIQUE(guildId, count)
  );

  CREATE TABLE IF NOT EXISTS invite_logs (
    guildId TEXT PRIMARY KEY,
    channelId TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    userId TEXT NOT NULL,
    channelId TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    category TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS ticket_settings (
    guildId TEXT PRIMARY KEY,
    category_id TEXT,
    log_channel TEXT,
    staff_role TEXT,
    panel_channel TEXT,
    support_message TEXT DEFAULT 'Click the button below to open a ticket!',
    ticket_message TEXT DEFAULT 'Thank you for opening a ticket! Support will be with you shortly.',
    panel_data TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS reaction_roles (
    guildId TEXT PRIMARY KEY,
    panel_data TEXT DEFAULT '{}',
    roles_data TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS forms_settings (
    guildId TEXT PRIMARY KEY,
    log_channel TEXT,
    panel_data TEXT DEFAULT '{}',
    questions TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS captcha_settings (
    guildId TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    unverified_role TEXT,
    verified_role TEXT,
    panel_channel TEXT,
    panel_data TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS auto_reply (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    trigger TEXT NOT NULL,
    response TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS snipe (
    channelId TEXT PRIMARY KEY,
    content TEXT,
    authorId TEXT,
    authorTag TEXT,
    authorAvatar TEXT,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS log_settings (
    guildId TEXT PRIMARY KEY,
    ban_channel TEXT,
    unban_channel TEXT,
    kick_channel TEXT,
    timeout_channel TEXT,
    warn_channel TEXT,
    message_delete_channel TEXT,
    message_edit_channel TEXT,
    member_join_channel TEXT,
    member_leave_channel TEXT,
    channel_create_channel TEXT,
    channel_delete_channel TEXT,
    role_create_channel TEXT,
    role_delete_channel TEXT,
    nick_change_channel TEXT
  );

  CREATE TABLE IF NOT EXISTS reactroles (
    messageId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    emoji TEXT NOT NULL,
    roleId TEXT NOT NULL,
    UNIQUE(messageId, emoji)
  );

  CREATE TABLE IF NOT EXISTS aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    shortcut TEXT NOT NULL,
    command TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tempvoice_settings (
    guildId TEXT PRIMARY KEY,
    master_channel TEXT,
    category_id TEXT,
    panel_channel TEXT
  );

  CREATE TABLE IF NOT EXISTS jailed_users (
    userId TEXT,
    guildId TEXT,
    oldRoles TEXT,
    jailedAt INTEGER,
    PRIMARY KEY (userId, guildId)
  );

  CREATE TABLE IF NOT EXISTS jail_settings (
    guildId TEXT PRIMARY KEY,
    jailRoleId TEXT,
    jailChannelId TEXT,
    staffVoiceId TEXT
  );

  CREATE TABLE IF NOT EXISTS tempvoice_channels (
    channelId TEXT PRIMARY KEY,
    ownerId TEXT NOT NULL,
    guildId TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bot_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT DEFAULT 'online',
    activity_type TEXT DEFAULT 'PLAYING',
    activity_name TEXT DEFAULT 'E-246 System'
  );

  CREATE TABLE IF NOT EXISTS tempvoice_user_settings (
    userId TEXT PRIMARY KEY,
    preferredName TEXT,
    preferredLimit INTEGER
  );

  CREATE TABLE IF NOT EXISTS tempvoice_bans (
    channelId TEXT,
    targetId TEXT,
    PRIMARY KEY (channelId, targetId)
  );

  CREATE TABLE IF NOT EXISTS tempvoice_trusted (
    channelId TEXT,
    userId TEXT,
    PRIMARY KEY (channelId, userId)
  );

  CREATE TABLE IF NOT EXISTS stats_daily_members (
    guildId TEXT,
    date TEXT,
    joins INTEGER DEFAULT 0,
    leaves INTEGER DEFAULT 0,
    PRIMARY KEY (guildId, date)
  );

  CREATE TABLE IF NOT EXISTS stats_hourly_messages (
    guildId TEXT,
    date TEXT,
    hour INTEGER,
    message_count INTEGER DEFAULT 0,
    PRIMARY KEY (guildId, date, hour)
  );

  CREATE TABLE IF NOT EXISTS stats_daily_voice (
    guildId TEXT,
    date TEXT,
    seconds INTEGER DEFAULT 0,
    PRIMARY KEY (guildId, date)
  );

  CREATE TABLE IF NOT EXISTS social_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    platform TEXT NOT NULL,
    channelId TEXT NOT NULL,
    socialId TEXT NOT NULL,
    lastVideoId TEXT,
    message TEXT
  );
`);

try { db.exec("DELETE FROM whitelist WHERE id NOT IN (SELECT MIN(id) FROM whitelist GROUP BY guildId, targetId, type)"); } catch (e) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_whitelist_unique ON whitelist(guildId, targetId, type)"); } catch (e) {}
try { db.exec("DELETE FROM blacklist WHERE id NOT IN (SELECT MIN(id) FROM blacklist GROUP BY guildId, targetId, type)"); } catch (e) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_unique ON blacklist(guildId, targetId, type)"); } catch (e) {}
try { db.exec("DELETE FROM invite_ranks WHERE id NOT IN (SELECT MIN(id) FROM invite_ranks GROUP BY guildId, count)"); } catch (e) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_ranks_unique ON invite_ranks(guildId, count)"); } catch (e) {}

const helpers = {
  getGuildSettings(guildId) {
    let row = db.prepare('SELECT * FROM guild_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO guild_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM guild_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },
  setGuildSetting(guildId, key, value) {
    const allowed = ['prefix', 'giveaway_emoji', 'log_channel', 'setlog_channel', 'line_image', 'autoboost_channel', 'autoboost_message', 'reply_type'];
    if (!allowed.includes(key)) throw new Error(`Invalid setting key: ${key}`);
    db.prepare(`INSERT INTO guild_settings (guildId) VALUES (?) ON CONFLICT(guildId) DO NOTHING`).run(guildId);
    db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guildId = ?`).run(value, guildId);
  },

  addWarning(userId, guildId, reason, moderatorId) {
    return db.prepare('INSERT INTO warnings (userId, guildId, reason, moderatorId) VALUES (?, ?, ?, ?)').run(userId, guildId, reason, moderatorId);
  },
  getWarnings(userId, guildId) {
    return db.prepare('SELECT * FROM warnings WHERE userId = ? AND guildId = ? ORDER BY timestamp DESC').all(userId, guildId);
  },
  clearWarnings(userId, guildId) {
    return db.prepare('DELETE FROM warnings WHERE userId = ? AND guildId = ?').run(userId, guildId);
  },

  getLevel(userId, guildId) {
    return db.prepare('SELECT * FROM levels WHERE userId = ? AND guildId = ?').get(userId, guildId);
  },
  addXP(userId, guildId, xp) {
    db.prepare(`
      INSERT INTO levels (userId, guildId, xp, messages, last_message)
      VALUES (?, ?, ?, 1, strftime('%s', 'now'))
      ON CONFLICT(userId, guildId) DO UPDATE SET
        xp = xp + ?,
        messages = messages + 1,
        last_message = strftime('%s', 'now')
    `).run(userId, guildId, xp, xp);
  },
  addVoiceXP(userId, guildId, xp) {
    db.prepare(`
      INSERT INTO levels (userId, guildId, voice_xp)
      VALUES (?, ?, ?)
      ON CONFLICT(userId, guildId) DO UPDATE SET
        voice_xp = voice_xp + ?
    `).run(userId, guildId, xp, xp);
  },
  setLevel(userId, guildId, level, xp, voice_level, voice_xp) {
    db.prepare(`
      INSERT INTO levels (userId, guildId, level, xp, voice_level, voice_xp)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId, guildId) DO UPDATE SET level = ?, xp = ?, voice_level = ?, voice_xp = ?
    `).run(userId, guildId, level, xp, voice_level, voice_xp, level, xp, voice_level, voice_xp);
  },
  getLeaderboard(guildId, limit = 10) {
    return db.prepare('SELECT * FROM levels WHERE guildId = ? ORDER BY (xp + voice_xp) DESC LIMIT ?').all(guildId, limit);
  },
  getLevelSettings(guildId) {
    let row = db.prepare('SELECT * FROM level_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO level_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM level_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },

  getGreetSettings(guildId) {
    let row = db.prepare('SELECT * FROM greet_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO greet_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM greet_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },

  getAutomation(guildId, channelId) {
    return db.prepare('SELECT * FROM automation WHERE guildId = ? AND channelId = ?').all(guildId, channelId);
  },
  getAllAutomation(guildId) {
    return db.prepare('SELECT * FROM automation WHERE guildId = ?').all(guildId);
  },
  addAutomation(guildId, channelId, type, value) {
    db.prepare('DELETE FROM automation WHERE guildId = ? AND channelId = ? AND type = ?').run(guildId, channelId, type);
    return db.prepare('INSERT INTO automation (guildId, channelId, type, value) VALUES (?, ?, ?, ?)').run(guildId, channelId, type, value);
  },
  removeAutomation(guildId, channelId, type) {
    return db.prepare('DELETE FROM automation WHERE guildId = ? AND channelId = ? AND type = ?').run(guildId, channelId, type);
  },

  createGiveaway(messageId, channelId, guildId, prize, winners, host, endTime, emoji) {
    return db.prepare('INSERT INTO giveaways (messageId, channelId, guildId, prize, winners, host, endTime, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(messageId, channelId, guildId, prize, winners, host, endTime, emoji);
  },
  getGiveaway(messageId) {
    return db.prepare('SELECT * FROM giveaways WHERE messageId = ?').get(messageId);
  },
  getActiveGiveaways(guildId) {
    return db.prepare('SELECT * FROM giveaways WHERE guildId = ? AND ended = 0').all(guildId);
  },
  getAllActiveGiveaways() {
    return db.prepare('SELECT * FROM giveaways WHERE ended = 0 AND paused = 0').all();
  },
  endGiveaway(messageId) {
    return db.prepare('UPDATE giveaways SET ended = 1 WHERE messageId = ?').run(messageId);
  },
  updateGiveaway(messageId, field, value) {
    const allowed = ['prize', 'winners', 'emoji', 'endTime', 'ended', 'paused'];
    if (!allowed.includes(field)) throw new Error(`Invalid giveaway field: ${field}`);
    return db.prepare(`UPDATE giveaways SET ${field} = ? WHERE messageId = ?`).run(value, messageId);
  },

  getProtection(guildId) {
    let row = db.prepare('SELECT * FROM protection_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO protection_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM protection_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },
  getWhitelist(guildId) {
    return db.prepare('SELECT * FROM whitelist WHERE guildId = ?').all(guildId);
  },
  addWhitelist(guildId, targetId, type) {
    return db.prepare('INSERT OR IGNORE INTO whitelist (guildId, targetId, type) VALUES (?, ?, ?)').run(guildId, targetId, type);
  },
  removeWhitelist(guildId, targetId) {
    return db.prepare('DELETE FROM whitelist WHERE guildId = ? AND targetId = ?').run(guildId, targetId);
  },
  addBlacklist(guildId, targetId, type) {
    return db.prepare('INSERT OR IGNORE INTO blacklist (guildId, targetId, type) VALUES (?, ?, ?)').run(guildId, targetId, type);
  },
  removeBlacklist(guildId, targetId) {
    return db.prepare('DELETE FROM blacklist WHERE guildId = ? AND targetId = ?').run(guildId, targetId);
  },
  isWhitelisted(guildId, targetId) {
    return !!db.prepare('SELECT 1 FROM whitelist WHERE guildId = ? AND targetId = ?').get(guildId, targetId);
  },

  getInvites(userId, guildId) {
    let row = db.prepare('SELECT * FROM invites WHERE userId = ? AND guildId = ?').get(userId, guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO invites (userId, guildId) VALUES (?, ?)').run(userId, guildId);
      row = db.prepare('SELECT * FROM invites WHERE userId = ? AND guildId = ?').get(userId, guildId);
    }
    return row;
  },
  updateInvites(userId, guildId, field, value) {
    const allowed = ['total', 'fake', 'left', 'bonus'];
    if (!allowed.includes(field)) throw new Error(`Invalid invite field: ${field}`);
    db.prepare(`INSERT INTO invites (userId, guildId, ${field}) VALUES (?, ?, ?) ON CONFLICT(userId, guildId) DO UPDATE SET ${field} = ${field} + ?`).run(userId, guildId, value, value);
  },
  resetInvites(userId, guildId) {
    db.prepare('UPDATE invites SET total = 0, fake = 0, left = 0, bonus = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
  },
  resetAllInvites(guildId) {
    db.prepare('UPDATE invites SET total = 0, fake = 0, left = 0, bonus = 0 WHERE guildId = ?').run(guildId);
  },
  getInviteRanks(guildId) {
    return db.prepare('SELECT * FROM invite_ranks WHERE guildId = ? ORDER BY count ASC').all(guildId);
  },
  addInviteRank(guildId, count, roleId) {
    return db.prepare('INSERT OR REPLACE INTO invite_ranks (guildId, count, roleId) VALUES (?, ?, ?)').run(guildId, count, roleId);
  },
  getInviteLogs(guildId) {
    return db.prepare('SELECT * FROM invite_logs WHERE guildId = ?').get(guildId);
  },

  getTicketSettings(guildId) {
    let row = db.prepare('SELECT * FROM ticket_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO ticket_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM ticket_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },
  updateTicketSettings(guildId, data) {
    const current = this.getTicketSettings(guildId);
    const category_id = data.category_id !== undefined ? data.category_id : current.category_id;
    const log_channel = data.log_channel !== undefined ? data.log_channel : current.log_channel;
    const staff_role = data.staff_role !== undefined ? data.staff_role : current.staff_role;
    const panel_channel = data.panel_channel !== undefined ? data.panel_channel : current.panel_channel;
    const support_message = data.support_message !== undefined ? data.support_message : current.support_message;
    const ticket_message = data.ticket_message !== undefined ? data.ticket_message : current.ticket_message;
    const panel_data = data.panel_data !== undefined ? data.panel_data : current.panel_data;

    return db.prepare(`
      UPDATE ticket_settings
      SET category_id = ?, log_channel = ?, staff_role = ?, panel_channel = ?, support_message = ?, ticket_message = ?, panel_data = ?
      WHERE guildId = ?
    `).run(category_id, log_channel, staff_role, panel_channel, support_message, ticket_message, panel_data, guildId);
  },
  createTicket(guildId, userId, channelId, category) {
    return db.prepare('INSERT INTO tickets (guildId, userId, channelId, category) VALUES (?, ?, ?, ?)').run(guildId, userId, channelId, category);
  },
  getTicketByChannel(channelId) {
    return db.prepare('SELECT * FROM tickets WHERE channelId = ?').get(channelId);
  },
  updateTicketStatus(channelId, status) {
    return db.prepare('UPDATE tickets SET status = ? WHERE channelId = ?').run(status, channelId);
  },

  getAutoReplies(guildId) {
    return db.prepare('SELECT * FROM auto_reply WHERE guildId = ?').all(guildId);
  },
  addAutoReply(guildId, trigger, response) {
    return db.prepare('INSERT INTO auto_reply (guildId, trigger, response) VALUES (?, ?, ?)').run(guildId, trigger, response);
  },
  removeAutoReply(guildId, trigger) {
    return db.prepare('DELETE FROM auto_reply WHERE guildId = ? AND trigger = ?').run(guildId, trigger);
  },

  setSnipe: (channelId, content, authorId, authorTag, authorAvatar) => {
    db.prepare('INSERT OR REPLACE INTO snipe (channelId, content, authorId, authorTag, authorAvatar, timestamp) VALUES (?, ?, ?, ?, ?, strftime(\'%s\', \'now\'))').run(channelId, content, authorId, authorTag, authorAvatar);
  },
  getSnipe(channelId) {
    return db.prepare('SELECT * FROM snipe WHERE channelId = ?').get(channelId);
  },

  getLogSettings(guildId) {
    let row = db.prepare('SELECT * FROM log_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO log_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM log_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },
  setLogChannel(guildId, channelId) {
    this.setGuildSetting(guildId, 'log_channel', channelId);
    this.getLogSettings(guildId);
  },

  getAliases(guildId) {
    return db.prepare('SELECT * FROM aliases WHERE guildId = ?').all(guildId);
  },
  addAlias(guildId, shortcut, command) {
    return db.prepare('INSERT INTO aliases (guildId, shortcut, command) VALUES (?, ?, ?)').run(guildId, shortcut, command);
  },
  removeAlias(guildId, shortcut) {
    return db.prepare('DELETE FROM aliases WHERE guildId = ? AND shortcut = ?').run(guildId, shortcut);
  },

  getFormsSettings(guildId) {
    const row = db.prepare('SELECT * FROM forms_settings WHERE guildId = ?').get(guildId);
    if (row) return row;
    db.prepare('INSERT INTO forms_settings (guildId) VALUES (?)').run(guildId);
    return { guildId, log_channel: null, panel_data: '{}', questions: '[]' };
  },
  updateFormsSettings(guildId, data) {
    const current = this.getFormsSettings(guildId);
    const log_channel = data.log_channel !== undefined ? data.log_channel : current.log_channel;
    const panel_data = data.panel_data !== undefined ? data.panel_data : current.panel_data;
    const questions = data.questions !== undefined ? data.questions : current.questions;

    return db.prepare(`
      UPDATE forms_settings
      SET log_channel = ?, panel_data = ?, questions = ?
      WHERE guildId = ?
    `).run(log_channel, panel_data, questions, guildId);
  },

  getReactionRoles(guildId) {
    const row = db.prepare('SELECT * FROM reaction_roles WHERE guildId = ?').get(guildId);
    if (row) return row;
    db.prepare('INSERT INTO reaction_roles (guildId) VALUES (?)').run(guildId);
    return { guildId, panel_data: '{}', roles_data: '[]' };
  },
  updateReactionRoles(guildId, data) {
    const current = this.getReactionRoles(guildId);
    const panel_data = data.panel_data !== undefined ? data.panel_data : current.panel_data;
    const roles_data = data.roles_data !== undefined ? data.roles_data : current.roles_data;

    return db.prepare(`
      UPDATE reaction_roles
      SET panel_data = ?, roles_data = ?
      WHERE guildId = ?
    `).run(panel_data, roles_data, guildId);
  },

  getCaptchaSettings(guildId) {
    const row = db.prepare('SELECT * FROM captcha_settings WHERE guildId = ?').get(guildId);
    if (row) return row;
    db.prepare('INSERT INTO captcha_settings (guildId) VALUES (?)').run(guildId);
    return { guildId, enabled: 0, unverified_role: null, verified_role: null, panel_channel: null, panel_data: '{}' };
  },
  updateCaptchaSettings(guildId, data) {
    const current = this.getCaptchaSettings(guildId);
    const enabled = data.enabled !== undefined ? data.enabled : current.enabled;
    const unverified_role = data.unverified_role !== undefined ? data.unverified_role : current.unverified_role;
    const verified_role = data.verified_role !== undefined ? data.verified_role : current.verified_role;
    const panel_channel = data.panel_channel !== undefined ? data.panel_channel : current.panel_channel;
    const panel_data = data.panel_data !== undefined ? data.panel_data : current.panel_data;

    return db.prepare(`
      UPDATE captcha_settings
      SET enabled = ?, unverified_role = ?, verified_role = ?, panel_channel = ?, panel_data = ?
      WHERE guildId = ?
    `).run(enabled, unverified_role, verified_role, panel_channel, panel_data, guildId);
  },

  getTempVoiceSettings(guildId) {
    let row = db.prepare('SELECT * FROM tempvoice_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO tempvoice_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM tempvoice_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },
  updateTempVoiceSettings(guildId, master_channel, category_id) {
    return db.prepare('UPDATE tempvoice_settings SET master_channel = ?, category_id = ? WHERE guildId = ?').run(master_channel, category_id, guildId);
  },
  updateTempVoicePanel(guildId, panel_channel) {
    return db.prepare('UPDATE tempvoice_settings SET panel_channel = ? WHERE guildId = ?').run(panel_channel, guildId);
  },
  getJailSettings(guildId) {
    let row = db.prepare('SELECT * FROM jail_settings WHERE guildId = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO jail_settings (guildId) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM jail_settings WHERE guildId = ?').get(guildId);
    }
    return row;
  },
  setJailSettings(guildId, roleId, channelId, staffVoiceId) {
    return db.prepare(`
      INSERT INTO jail_settings (guildId, jailRoleId, jailChannelId, staffVoiceId)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guildId) DO UPDATE SET
        jailRoleId = excluded.jailRoleId,
        jailChannelId = excluded.jailChannelId,
        staffVoiceId = excluded.staffVoiceId
    `).run(guildId, roleId, channelId, staffVoiceId);
  },
  getJailedUser(userId, guildId) {
    return db.prepare('SELECT * FROM jailed_users WHERE userId = ? AND guildId = ?').get(userId, guildId);
  },
  addJailedUser(userId, guildId, oldRoles) {
    return db.prepare('INSERT OR REPLACE INTO jailed_users (userId, guildId, oldRoles, jailedAt) VALUES (?, ?, ?, strftime(\'%s\', \'now\'))').run(userId, guildId, oldRoles);
  },
  removeJailedUser(userId, guildId) {
    return db.prepare('DELETE FROM jailed_users WHERE userId = ? AND guildId = ?').run(userId, guildId);
  },
  
  addTempVoiceChannel(channelId, ownerId, guildId) {
    return db.prepare('INSERT INTO tempvoice_channels (channelId, ownerId, guildId) VALUES (?, ?, ?)').run(channelId, ownerId, guildId);
  },
  getTempVoiceChannel(channelId) {
    return db.prepare('SELECT * FROM tempvoice_channels WHERE channelId = ?').get(channelId);
  },
  removeTempVoiceChannel(channelId) {
    return db.prepare('DELETE FROM tempvoice_channels WHERE channelId = ?').run(channelId);
  },
  getTempVoiceChannelsByGuild(guildId) {
    return db.prepare('SELECT * FROM tempvoice_channels WHERE guildId = ?').all(guildId);
  },

  getBotSettings() {
    let row = db.prepare('SELECT * FROM bot_settings WHERE id = 1').get();
    if (!row) {
      db.prepare("INSERT OR IGNORE INTO bot_settings (id, status, activity_type, activity_name) VALUES (1, 'online', 'PLAYING', 'E-246 System')").run();
      row = db.prepare('SELECT * FROM bot_settings WHERE id = 1').get();
    }
    return row;
  },
  updateBotSettings(status, activity_type, activity_name) {
    return db.prepare('UPDATE bot_settings SET status = ?, activity_type = ?, activity_name = ? WHERE id = 1').run(status, activity_type, activity_name);
  },

  
  getTempVoiceUserSettings(userId) {
    return db.prepare('SELECT * FROM tempvoice_user_settings WHERE userId = ?').get(userId);
  },
  saveTempVoiceUserSettings(userId, name, limit) {
    return db.prepare(`
      INSERT INTO tempvoice_user_settings (userId, preferredName, preferredLimit)
      VALUES (?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET preferredName = ?, preferredLimit = ?
    `).run(userId, name, limit, name, limit);
  },

  
  addTempVoiceBan(channelId, targetId) {
    return db.prepare('INSERT OR IGNORE INTO tempvoice_bans (channelId, targetId) VALUES (?, ?)').run(channelId, targetId);
  },
  removeTempVoiceBan(channelId, targetId) {
    return db.prepare('DELETE FROM tempvoice_bans WHERE channelId = ? AND targetId = ?').run(channelId, targetId);
  },
  isTempVoiceBanned(channelId, targetId) {
    const row = db.prepare('SELECT 1 FROM tempvoice_bans WHERE channelId = ? AND targetId = ?').get(channelId, targetId);
    return !!row;
  },
  getTempVoiceBans(channelId) {
    return db.prepare('SELECT targetId FROM tempvoice_bans WHERE channelId = ?').all(channelId);
  },

  
  addTempVoiceTrusted(channelId, userId) {
    return db.prepare('INSERT OR IGNORE INTO tempvoice_trusted (channelId, userId) VALUES (?, ?)').run(channelId, userId);
  },
  removeTempVoiceTrusted(channelId, userId) {
    return db.prepare('DELETE FROM tempvoice_trusted WHERE channelId = ? AND userId = ?').run(channelId, userId);
  },
  isTempVoiceTrusted(channelId, userId) {
    const row = db.prepare('SELECT 1 FROM tempvoice_trusted WHERE channelId = ? AND userId = ?').get(channelId, userId);
    return !!row;
  },
  getTempVoiceTrustedUsers(channelId) {
    return db.prepare('SELECT userId FROM tempvoice_trusted WHERE channelId = ?').all(channelId);
  },

  
  incrementDailyJoins(guildId) {
    return db.prepare(`
      INSERT INTO stats_daily_members (guildId, date, joins)
      VALUES (?, strftime('%Y-%m-%d', 'now'), 1)
      ON CONFLICT(guildId, date) DO UPDATE SET joins = joins + 1
    `).run(guildId);
  },
  incrementDailyLeaves(guildId) {
    return db.prepare(`
      INSERT INTO stats_daily_members (guildId, date, leaves)
      VALUES (?, strftime('%Y-%m-%d', 'now'), 1)
      ON CONFLICT(guildId, date) DO UPDATE SET leaves = leaves + 1
    `).run(guildId);
  },
  incrementHourlyMessages(guildId) {
    return db.prepare(`
      INSERT INTO stats_hourly_messages (guildId, date, hour, message_count)
      VALUES (?, strftime('%Y-%m-%d', 'now'), CAST(strftime('%H', 'now') AS INTEGER), 1)
      ON CONFLICT(guildId, date, hour) DO UPDATE SET message_count = message_count + 1
    `).run(guildId);
  },
  addDailyVoiceSeconds(guildId, seconds) {
    return db.prepare(`
      INSERT INTO stats_daily_voice (guildId, date, seconds)
      VALUES (?, strftime('%Y-%m-%d', 'now'), ?)
      ON CONFLICT(guildId, date) DO UPDATE SET seconds = seconds + ?
    `).run(guildId, seconds, seconds);
  },

  
  getDailyMembersStats(guildId, daysCount = 7) {
    return db.prepare(`
      SELECT date, joins, leaves 
      FROM stats_daily_members 
      WHERE guildId = ? 
      ORDER BY date DESC 
      LIMIT ?
    `).all(guildId, daysCount).reverse();
  },
  getHourlyMessagesStats(guildId) {
    
    return db.prepare(`
      SELECT hour, SUM(message_count) as count 
      FROM stats_hourly_messages 
      WHERE guildId = ? 
      GROUP BY hour 
      ORDER BY hour ASC
    `).all(guildId);
  },
  getDailyVoiceStats(guildId, daysCount = 7) {
    return db.prepare(`
      SELECT date, seconds 
      FROM stats_daily_voice 
      WHERE guildId = ? 
      ORDER BY date DESC 
      LIMIT ?
    `).all(guildId, daysCount).reverse();
  },

  
  getSocialAlerts(guildId) {
    return db.prepare('SELECT * FROM social_alerts WHERE guildId = ?').all(guildId);
  },
  getAllSocialAlerts() {
    return db.prepare('SELECT * FROM social_alerts').all();
  },
  addSocialAlert(guildId, platform, channelId, socialId, message) {
    return db.prepare('INSERT INTO social_alerts (guildId, platform, channelId, socialId, message) VALUES (?, ?, ?, ?, ?)').run(guildId, platform, channelId, socialId, message);
  },
  removeSocialAlert(id, guildId) {
    return db.prepare('DELETE FROM social_alerts WHERE id = ? AND guildId = ?').run(id, guildId);
  },
  updateSocialAlertLastVideo(id, lastVideoId) {
    return db.prepare('UPDATE social_alerts SET lastVideoId = ? WHERE id = ?').run(lastVideoId, id);
  },

  db,
};

module.exports = helpers;
