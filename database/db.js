const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/e246';
const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
let mongoDb = null;

const cache = {
  guild_settings: new Map(),
  warnings: [],
  levels: new Map(),
  level_settings: new Map(),
  greet_settings: new Map(),
  automation: [],
  giveaways: new Map(),
  protection_settings: new Map(),
  whitelist: [],
  blacklist: [],
  invites: new Map(),
  invite_uses: new Map(),
  invite_ranks: [],
  invite_logs: new Map(),
  tickets: [],
  ticket_settings: new Map(),
  ticket_blacklist: [],
  ticket_warnings: [],
  reaction_roles: new Map(),
  forms_settings: new Map(),
  captcha_settings: new Map(),
  auto_reply: [],
  snipe: new Map(),
  log_settings: new Map(),
  reactroles: [],
  aliases: [],
  tempvoice_settings: new Map(),
  jailed_users: new Map(),
  jail_settings: new Map(),
  tempvoice_channels: new Map(),
  bot_settings: new Map(),
  tempvoice_user_settings: new Map(),
  tempvoice_bans: new Map(),
  tempvoice_trusted: new Map(),
  stats_daily_members: new Map(),
  stats_hourly_messages: new Map(),
  stats_daily_voice: new Map(),
  social_alerts: []
};


function stripId(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return doc;
  const out = { ...doc };
  delete out._id;
  return out;
}

function safeSet(doc) {
  return { $set: stripId(doc) };
}

async function loadMongoCache() {
  const collections = await mongoDb.collections();
  const names = collections.map(c => c.collectionName);

  const mapCollections = [
    { name: 'guild_settings', key: d => d.guildId },
    { name: 'levels', key: d => `${d.userId}_${d.guildId}` },
    { name: 'level_settings', key: d => d.guildId },
    { name: 'greet_settings', key: d => d.guildId },
    { name: 'giveaways', key: d => d.messageId },
    { name: 'protection_settings', key: d => d.guildId },
    { name: 'invites', key: d => `${d.userId}_${d.guildId}` },
    { name: 'invite_uses', key: d => `${d.code}_${d.guildId}` },
    { name: 'invite_logs', key: d => d.guildId },
    { name: 'ticket_settings', key: d => d.guildId },
    { name: 'reaction_roles', key: d => d.guildId },
    { name: 'forms_settings', key: d => d.guildId },
    { name: 'captcha_settings', key: d => d.guildId },
    { name: 'log_settings', key: d => d.guildId },
    { name: 'tempvoice_settings', key: d => d.guildId },
    { name: 'jailed_users', key: d => `${d.userId}_${d.guildId}` },
    { name: 'jail_settings', key: d => d.guildId },
    { name: 'tempvoice_channels', key: d => d.channelId },
    { name: 'bot_settings', key: d => d.id || 1 },
    { name: 'tempvoice_user_settings', key: d => d.userId },
    { name: 'tempvoice_bans', key: d => `${d.channelId}_${d.targetId}` },
    { name: 'tempvoice_trusted', key: d => `${d.channelId}_${d.userId}` },
    { name: 'stats_daily_members', key: d => `${d.guildId}_${d.date}` },
    { name: 'stats_hourly_messages', key: d => `${d.guildId}_${d.date}_${d.hour}` },
    { name: 'stats_daily_voice', key: d => `${d.guildId}_${d.date}` },
    { name: 'snipe', key: d => d.channelId }
  ];

  const arrayCollections = [
    'warnings', 'automation', 'whitelist', 'blacklist', 'invite_ranks',
    'tickets', 'auto_reply', 'reactroles', 'aliases', 'social_alerts',
    'ticket_blacklist', 'ticket_warnings'
  ];

  for (const col of mapCollections) {
    if (names.includes(col.name)) {
      const data = await mongoDb.collection(col.name).find({}).toArray();
      for (const doc of data) {
        cache[col.name].set(col.key(doc), doc);
      }
    }
  }

  for (const name of arrayCollections) {
    if (names.includes(name)) {
      const data = await mongoDb.collection(name).find({}).toArray();
      cache[name].push(...data);
    }
  }

  console.log('[MongoDB] In-memory cache loaded successfully');
}

async function connect() {
  await client.connect();
  const dbName = client.options?.dbName || client.options?.databaseName || mongoUri.split('/').pop().split('?')[0] || 'e246';
  mongoDb = client.db(dbName);
  if (!mongoDb) throw new Error('MongoDB client.db() returned null — check your connection string');
  console.log('✅ [MongoDB] Connected successfully to database');
  
  // Auto-delete message cache entries after 3 days (259200 seconds) to save database space
  await mongoDb.collection('message_cache').createIndex({ createdAt: 1 }, { expireAfterSeconds: 259200 }).catch(() => {});
  
  await loadMongoCache();
}

function translateSql(opType, sql, args) {
  if (!mongoDb) { console.error('[DB] translateSql called before MongoDB was connected'); return opType === 'get' ? null : { changes: 0 }; }
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  if (/UPDATE log_settings SET (\w+) = \? WHERE guildId = \?/i.test(cleanSql)) {
    const colName = cleanSql.match(/UPDATE log_settings SET (\w+) = \? WHERE guildId = \?/i)[1];
    const [value, guildId] = args;
    let doc = cache.log_settings.get(guildId) || { guildId };
    doc[colName] = value;
    cache.log_settings.set(guildId, doc);
    mongoDb.collection('log_settings').updateOne({ guildId }, { $set: { [colName]: value } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/INSERT OR REPLACE INTO reactroles/i.test(cleanSql)) {
    const [messageId, guildId, emoji, roleId] = args;
    const idx = cache.reactroles.findIndex(r => r.messageId === messageId && r.emoji === emoji);
    const newDoc = { messageId, guildId, emoji, roleId };
    if (idx !== -1) {
      cache.reactroles[idx] = newDoc;
    } else {
      cache.reactroles.push(newDoc);
    }
    mongoDb.collection('reactroles').updateOne({ messageId, emoji }, { $set: stripId(newDoc) }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET channel = \?, enabled = 1 WHERE guildId = \?/i.test(cleanSql)) {
    const [channel, guildId] = args;
    let doc = cache.greet_settings.get(guildId) || { guildId };
    doc.channel = channel;
    doc.enabled = 1;
    cache.greet_settings.set(guildId, doc);
    mongoDb.collection('greet_settings').updateOne({ guildId }, { $set: { channel, enabled: 1 } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET delete_after = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [delete_after, guildId] = args;
    let doc = cache.greet_settings.get(guildId) || { guildId };
    doc.delete_after = delete_after;
    cache.greet_settings.set(guildId, doc);
    mongoDb.collection('greet_settings').updateOne({ guildId }, { $set: { delete_after } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET dm_message = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [dm_message, guildId] = args;
    let doc = cache.greet_settings.get(guildId) || { guildId };
    doc.dm_message = dm_message;
    cache.greet_settings.set(guildId, doc);
    mongoDb.collection('greet_settings').updateOne({ guildId }, { $set: { dm_message } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET message = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [message, guildId] = args;
    let doc = cache.greet_settings.get(guildId) || { guildId };
    doc.message = message;
    cache.greet_settings.set(guildId, doc);
    mongoDb.collection('greet_settings').updateOne({ guildId }, { $set: { message } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/INSERT INTO invite_logs/i.test(cleanSql)) {
    const [guildId, channelId] = args;
    cache.invite_logs.set(guildId, { guildId, channelId });
    mongoDb.collection('invite_logs').updateOne({ guildId }, { $set: { channelId } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET enabled = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [enabled, guildId] = args;
    let doc = cache.level_settings.get(guildId) || { guildId };
    doc.enabled = enabled;
    cache.level_settings.set(guildId, doc);
    mongoDb.collection('level_settings').updateOne({ guildId }, { $set: { enabled } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET channel = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [channel, guildId] = args;
    let doc = cache.level_settings.get(guildId) || { guildId };
    doc.channel = channel;
    cache.level_settings.set(guildId, doc);
    mongoDb.collection('level_settings').updateOne({ guildId }, { $set: { channel } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET xp_min = \?, xp_max = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [xp_min, xp_max, guildId] = args;
    let doc = cache.level_settings.get(guildId) || { guildId };
    doc.xp_min = xp_min;
    doc.xp_max = xp_max;
    cache.level_settings.set(guildId, doc);
    mongoDb.collection('level_settings').updateOne({ guildId }, { $set: { xp_min, xp_max } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET xp_cooldown = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [xp_cooldown, guildId] = args;
    let doc = cache.level_settings.get(guildId) || { guildId };
    doc.xp_cooldown = xp_cooldown;
    cache.level_settings.set(guildId, doc);
    mongoDb.collection('level_settings').updateOne({ guildId }, { $set: { xp_cooldown } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET role_rewards = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [role_rewards, guildId] = args;
    let rewards = role_rewards;
    if (typeof role_rewards === 'string') {
      try {
        rewards = JSON.parse(role_rewards);
      } catch {
        rewards = [];
      }
    }
    if (!Array.isArray(rewards)) rewards = [];
    let doc = cache.level_settings.get(guildId) || { guildId };
    doc.role_rewards = rewards;
    cache.level_settings.set(guildId, doc);
    mongoDb.collection('level_settings').updateOne({ guildId }, { $set: { role_rewards: rewards } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/INSERT INTO protection_settings \(guildId\) VALUES \(\?\) ON CONFLICT\(guildId\) DO NOTHING/i.test(cleanSql)) {
    const [guildId] = args;
    if (!cache.protection_settings.has(guildId)) {
      const newDoc = { guildId, enabled: 0 };
      cache.protection_settings.set(guildId, newDoc);
      mongoDb.collection('protection_settings').insertOne(newDoc).catch(() => null);
    }
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET (\w+) = \?, bypass_role = COALESCE\(\?, bypass_role\) WHERE guildId = \?/i.test(cleanSql)) {
    const match = cleanSql.match(/UPDATE protection_settings SET (\w+) = \?, bypass_role = COALESCE\(\?, bypass_role\) WHERE guildId = \?/i);
    const colName = match[1];
    const [val, bypass, guildId] = args;
    let doc = cache.protection_settings.get(guildId) || { guildId };
    doc[colName] = val;
    if (bypass !== null) doc.bypass_role = bypass;
    cache.protection_settings.set(guildId, doc);
    const updateObj = { [colName]: val };
    if (bypass !== null) updateObj.bypass_role = bypass;
    mongoDb.collection('protection_settings').updateOne({ guildId }, { $set: updateObj }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET (\w+) = \? WHERE guildId = \?/i.test(cleanSql)) {
    const match = cleanSql.match(/UPDATE protection_settings SET (\w+) = \? WHERE guildId = \?/i);
    const colName = match[1];
    const [val, guildId] = args;
    let doc = cache.protection_settings.get(guildId) || { guildId };
    doc[colName] = val;
    cache.protection_settings.set(guildId, doc);
    mongoDb.collection('protection_settings').updateOne({ guildId }, { $set: { [colName]: val } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET enabled = 1 WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    let doc = cache.protection_settings.get(guildId) || { guildId };
    doc.enabled = 1;
    cache.protection_settings.set(guildId, doc);
    mongoDb.collection('protection_settings').updateOne({ guildId }, { $set: { enabled: 1 } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET enabled = 0 WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    let doc = cache.protection_settings.get(guildId) || { guildId };
    doc.enabled = 0;
    cache.protection_settings.set(guildId, doc);
    mongoDb.collection('protection_settings').updateOne({ guildId }, { $set: { enabled: 0 } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET action = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [action, guildId] = args;
    let doc = cache.protection_settings.get(guildId) || { guildId };
    doc.action = action;
    cache.protection_settings.set(guildId, doc);
    mongoDb.collection('protection_settings').updateOne({ guildId }, { $set: { action: action } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/INSERT INTO ticket_settings/i.test(cleanSql)) {
    const [guildId, category_id, staff_role, log_channel, ticket_message, feedbacks_channel, owners_role] = args;
    let doc = cache.ticket_settings.get(guildId) || { guildId };
    doc.category_id = category_id;
    doc.staff_role = staff_role;
    if (log_channel !== null) doc.log_channel = log_channel;
    if (ticket_message !== null) doc.ticket_message = ticket_message;
    cache.ticket_settings.set(guildId, doc);
    const updateObj = { category_id, staff_role };
    if (log_channel !== null) updateObj.log_channel = log_channel;
    if (ticket_message !== null) updateObj.ticket_message = ticket_message;
    mongoDb.collection('ticket_settings').updateOne({ guildId }, { $set: updateObj }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/SELECT \* FROM reactroles WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    return cache.reactroles.filter(r => r.guildId === guildId);
  }

  if (/SELECT \* FROM levels WHERE guildId = \? ORDER BY messages DESC LIMIT 10/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.levels.values())
      .filter(u => u.guildId === guildId)
      .sort((a, b) => (b.messages || 0) - (a.messages || 0))
      .slice(0, 10);
  }

  if (/SELECT \* FROM levels WHERE guildId = \? ORDER BY voice_xp DESC LIMIT 10/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.levels.values())
      .filter(u => u.guildId === guildId)
      .sort((a, b) => (b.voice_xp || 0) - (a.voice_xp || 0))
      .slice(0, 10);
  }

  if (/SELECT \* FROM levels WHERE guildId = \? ORDER BY reactionsCount DESC LIMIT 10/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.levels.values())
      .filter(u => u.guildId === guildId)
      .sort((a, b) => (b.reactionsCount || 0) - (a.reactionsCount || 0))
      .slice(0, 10);
  }

  if (/DELETE FROM reactroles WHERE guildId = \? AND messageId = \? AND emoji = \?/i.test(cleanSql)) {
    const [guildId, messageId, emoji] = args;
    const idx = cache.reactroles.findIndex(r => r.guildId === guildId && r.messageId === messageId && r.emoji === emoji);
    if (idx !== -1) cache.reactroles.splice(idx, 1);
    mongoDb.collection('reactroles').deleteOne({ guildId, messageId, emoji }).catch(console.error);
    return { changes: 1 };
  }

  if (/SELECT \* FROM invites WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.invites.values()).filter(i => i.guildId === guildId);
  }

  if (/SELECT \* FROM tickets WHERE guildId = \? AND userId = \? AND status = 'open'/i.test(cleanSql)) {
    const [guildId, userId] = args;
    return cache.tickets.find(t => t.guildId === guildId && t.userId === userId && t.status === 'open');
  }

  if (/INSERT INTO level_settings/i.test(cleanSql)) {
    const [guildId, enabled, channel, xp_min, xp_max] = args;
    let doc = cache.level_settings.get(guildId) || { guildId };
    doc.enabled = enabled;
    doc.channel = channel;
    doc.xp_min = xp_min;
    doc.xp_max = xp_max;
    cache.level_settings.set(guildId, doc);
    mongoDb.collection('level_settings').updateOne({ guildId }, { $set: { enabled, channel, xp_min, xp_max } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/INSERT INTO greet_settings/i.test(cleanSql)) {
    const [guildId, enabled, channel, messageText, image_url, avatar_x, avatar_y, avatar_size, username_x, username_y, username_color, username_size] = args;
    let doc = cache.greet_settings.get(guildId) || { guildId };
    doc.enabled = enabled;
    doc.channel = channel;
    doc.message = messageText;
    doc.image_url = image_url;
    doc.avatar_x = avatar_x;
    doc.avatar_y = avatar_y;
    doc.avatar_size = avatar_size;
    doc.username_x = username_x;
    doc.username_y = username_y;
    doc.username_color = username_color;
    doc.username_size = username_size;
    cache.greet_settings.set(guildId, doc);
    mongoDb.collection('greet_settings').updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/INSERT INTO protection_settings/i.test(cleanSql)) {
    const [guildId, enabled, ban_limit, kick_limit, action] = args;
    let doc = cache.protection_settings.get(guildId) || { guildId };
    doc.enabled = enabled;
    doc.ban_limit = ban_limit;
    doc.kick_limit = kick_limit;
    doc.action = action;
    cache.protection_settings.set(guildId, doc);
    mongoDb.collection('protection_settings').updateOne({ guildId }, { $set: { enabled, ban_limit, kick_limit, action } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/INSERT INTO log_settings/i.test(cleanSql)) {
    const [guildId, ...channelVals] = args;
    const cols = [
      'ban_channel', 'unban_channel', 'kick_channel', 'timeout_channel', 'warn_channel',
      'message_delete_channel', 'message_edit_channel', 'member_join_channel', 'member_leave_channel',
      'channel_create_channel', 'channel_delete_channel', 'role_create_channel', 'role_delete_channel', 'nick_change_channel'
    ];
    let doc = cache.log_settings.get(guildId) || { guildId };
    for (let i = 0; i < cols.length; i++) {
      doc[cols[i]] = channelVals[i];
    }
    cache.log_settings.set(guildId, doc);
    mongoDb.collection('log_settings').updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/SELECT \* FROM levels WHERE userId = \? AND guildId = \?/i.test(cleanSql)) {
    const [userId, guildId] = args;
    return cache.levels.get(`${userId}_${guildId}`) || null;
  }

  if (/INSERT INTO levels \(userId, guildId\)/i.test(cleanSql)) {
    const [userId, guildId] = args;
    const now = Math.floor(Date.now() / 1000);
    const newDoc = { userId, guildId, xp: 0, voice_xp: 0, level: 0, voice_level: 0, messages: 0, last_message: now, reactionsCount: 0 };
    cache.levels.set(`${userId}_${guildId}`, newDoc);
    mongoDb.collection('levels').insertOne(newDoc).catch(console.error);
    return { changes: 1 };
  }

  if (/UPDATE levels SET reactionsCount =/i.test(cleanSql)) {
    const [userId, guildId] = args;
    let doc = cache.levels.get(`${userId}_${guildId}`);
    if (!doc) {
      const now = Math.floor(Date.now() / 1000);
      doc = { userId, guildId, xp: 0, voice_xp: 0, level: 0, voice_level: 0, messages: 0, last_message: now, reactionsCount: 1 };
    } else {
      doc.reactionsCount = (doc.reactionsCount || 0) + 1;
    }
    cache.levels.set(`${userId}_${guildId}`, doc);
    mongoDb.collection('levels').updateOne({ userId, guildId }, { $set: { reactionsCount: doc.reactionsCount } }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  }

  if (/SELECT \* FROM reactroles WHERE messageId = \? AND emoji = \?/i.test(cleanSql)) {
    const [messageId, emoji] = args;
    return cache.reactroles.find(r => r.messageId === messageId && r.emoji === emoji) || null;
  }

  console.warn('[DB Mock] Unhandled raw SQL statement executed:', sql, args);
  return { changes: 0 };
}

const helpers = {
  connect,

  get db() {
    return {
      prepare(sql) {
        return {
          run(...args) { return translateSql('run', sql, args); },
          get(...args) { return translateSql('get', sql, args); },
          all(...args) { return translateSql('all', sql, args); }
        };
      }
    };
  },

  getGuildSettings(guildId) {
    let row = cache.guild_settings.get(guildId);
    if (!row) {
      row = { guildId, prefix: '#', giveaway_emoji: '🎉', reply_type: 'embed' };
      cache.guild_settings.set(guildId, row);
      mongoDb.collection('guild_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  setGuildSetting(guildId, key, value) {
    const allowed = ['prefix', 'giveaway_emoji', 'log_channel', 'setlog_channel', 'line_image', 'autoboost_channel', 'autoboost_message', 'reply_type', 'bank_channel'];
    if (!allowed.includes(key)) throw new Error(`Invalid setting key: ${key}`);

    let doc = cache.guild_settings.get(guildId) || { guildId };
    doc[key] = value;
    cache.guild_settings.set(guildId, doc);
    mongoDb.collection('guild_settings').updateOne({ guildId }, { $set: { [key]: value } }, { upsert: true }).catch(console.error);
  },

  addWarning(userId, guildId, reason, moderatorId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const newDoc = { userId, guildId, reason, moderatorId, timestamp };
    cache.warnings.push(newDoc);
    mongoDb.collection('warnings').insertOne(newDoc).catch(console.error);
    return { changes: 1 };
  },
  getWarnings(userId, guildId) {
    return cache.warnings.filter(w => w.userId === userId && w.guildId === guildId).sort((a, b) => b.timestamp - a.timestamp);
  },
  clearWarnings(userId, guildId) {
    cache.warnings = cache.warnings.filter(w => !(w.userId === userId && w.guildId === guildId));
    mongoDb.collection('warnings').deleteMany({ userId, guildId }).catch(console.error);
    return { changes: 1 };
  },

  getLevel(userId, guildId) {
    return cache.levels.get(`${userId}_${guildId}`);
  },
  addXP(userId, guildId, xp) {
    const now = Math.floor(Date.now() / 1000);
    let doc = cache.levels.get(`${userId}_${guildId}`);
    if (!doc) {
      doc = { userId, guildId, xp, voice_xp: 0, level: 0, voice_level: 0, messages: 1, last_message: now, reactionsCount: 0 };
    } else {
      doc.xp = (doc.xp || 0) + xp;
      doc.messages = (doc.messages || 0) + 1;
      doc.last_message = now;
    }
    cache.levels.set(`${userId}_${guildId}`, doc);
    mongoDb.collection('levels').updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
  },
  addVoiceXP(userId, guildId, xp) {
    let doc = cache.levels.get(`${userId}_${guildId}`);
    if (!doc) {
      doc = { userId, guildId, xp: 0, voice_xp: xp, level: 0, voice_level: 0, messages: 0, last_message: 0, reactionsCount: 0 };
    } else {
      doc.voice_xp = (doc.voice_xp || 0) + xp;
    }
    cache.levels.set(`${userId}_${guildId}`, doc);
    mongoDb.collection('levels').updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
  },
  setLevel(userId, guildId, level, xp, voice_level, voice_xp) {
    let doc = cache.levels.get(`${userId}_${guildId}`) || { userId, guildId, messages: 0, last_message: 0, reactionsCount: 0 };
    doc.level = level;
    doc.xp = xp;
    doc.voice_level = voice_level;
    doc.voice_xp = voice_xp;
    cache.levels.set(`${userId}_${guildId}`, doc);
    mongoDb.collection('levels').updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
  },
  getLeaderboard(guildId, limit = 10) {
    return Array.from(cache.levels.values())
      .filter(u => u.guildId === guildId)
      .sort((a, b) => ((b.xp || 0) + (b.voice_xp || 0)) - ((a.xp || 0) + (a.voice_xp || 0)))
      .slice(0, limit);
  },
  getUserRank(userId, guildId) {
    const list = Array.from(cache.levels.values())
      .filter(u => u.guildId === guildId)
      .sort((a, b) => ((b.xp || 0) + (b.voice_xp || 0)) - ((a.xp || 0) + (a.voice_xp || 0)));
    const idx = list.findIndex(u => u.userId === userId);
    return idx !== -1 ? idx + 1 : null;
  },
  getLevelSettings(guildId) {
    let row = cache.level_settings.get(guildId);
    if (!row) {
      row = { guildId, enabled: 1, channel: null, xp_min: 15, xp_max: 25, xp_cooldown: 60, role_rewards: [] };
      cache.level_settings.set(guildId, row);
      mongoDb.collection('level_settings').insertOne(row).catch(() => null);
    }
    return row;
  },

  getGreetSettings(guildId) {
    let row = cache.greet_settings.get(guildId);
    if (!row) {
      row = {
        guildId, channel: null, message: 'Welcome {user} to {server}!', dm_message: null, delete_after: 0,
        enabled: 0, image_url: null, avatar_x: 100, avatar_y: 100, avatar_size: 150,
        username_x: 100, username_y: 300, username_color: '#ffffff', username_size: 40
      };
      cache.greet_settings.set(guildId, row);
      mongoDb.collection('greet_settings').insertOne(row).catch(() => null);
    }
    return row;
  },

  getAutomation(guildId, channelId) {
    return cache.automation.filter(a => a.guildId === guildId && a.channelId === channelId);
  },
  getAllAutomation(guildId) {
    return cache.automation.filter(a => a.guildId === guildId);
  },
  addAutomation(guildId, channelId, type, value) {
    cache.automation = cache.automation.filter(a => !(a.guildId === guildId && a.channelId === channelId && a.type === type));
    mongoDb.collection('automation').deleteMany({ guildId, channelId, type }).catch(() => null);

    const newDoc = { guildId, channelId, type, value };
    cache.automation.push(newDoc);
    mongoDb.collection('automation').insertOne(newDoc).catch(console.error);
    return { changes: 1 };
  },
  removeAutomation(guildId, channelId, type) {
    cache.automation = cache.automation.filter(a => !(a.guildId === guildId && a.channelId === channelId && a.type === type));
    mongoDb.collection('automation').deleteMany({ guildId, channelId, type }).catch(console.error);
    return { changes: 1 };
  },

  createGiveaway(messageId, channelId, guildId, prize, winners, host, endTime, emoji) {
    const doc = { messageId, channelId, guildId, prize, winners, host, endTime, emoji, ended: 0, paused: 0 };
    cache.giveaways.set(messageId, doc);
    mongoDb.collection('giveaways').insertOne(doc).catch(console.error);
    return { changes: 1 };
  },
  getGiveaway(messageId) {
    return cache.giveaways.get(messageId);
  },
  getActiveGiveaways(guildId) {
    return Array.from(cache.giveaways.values()).filter(g => g.guildId === guildId && g.ended === 0);
  },
  getAllActiveGiveaways() {
    return Array.from(cache.giveaways.values()).filter(g => g.ended === 0 && g.paused === 0);
  },
  endGiveaway(messageId) {
    let doc = cache.giveaways.get(messageId);
    if (doc) {
      doc.ended = 1;
      cache.giveaways.set(messageId, doc);
      mongoDb.collection('giveaways').updateOne({ messageId }, { $set: { ended: 1 } }).catch(console.error);
    }
    return { changes: 1 };
  },
  updateGiveaway(messageId, field, value) {
    const allowed = ['prize', 'winners', 'emoji', 'endTime', 'ended', 'paused'];
    if (!allowed.includes(field)) throw new Error(`Invalid giveaway field: ${field}`);

    let doc = cache.giveaways.get(messageId);
    if (doc) {
      doc[field] = value;
      cache.giveaways.set(messageId, doc);
      mongoDb.collection('giveaways').updateOne({ messageId }, { $set: { [field]: value } }).catch(console.error);
    }
    return { changes: 1 };
  },

  getProtection(guildId) {
    let row = cache.protection_settings.get(guildId);
    if (!row) {
      row = {
        guildId, enabled: 0, antilink: 0, antispam: 0, antiraid: 0, bypass_role: null,
        ban_limit: 3, kick_limit: 3, channel_limit: 3, role_limit: 3, webhook_limit: 3, action: 'ban'
      };
      cache.protection_settings.set(guildId, row);
      mongoDb.collection('protection_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateProtection(guildId, data) {
    let current = this.getProtection(guildId);
    const fields = [
      'enabled', 'antilink', 'antispam', 'antiraid', 'bypass_role',
      'ban_limit', 'kick_limit', 'channel_limit', 'role_limit', 'webhook_limit', 'action'
    ];
    for (const key of fields) {
      if (data[key] !== undefined) current[key] = data[key];
    }
    cache.protection_settings.set(guildId, current);
    return mongoDb.collection('protection_settings').updateOne(
      { guildId },
      { $set: stripId(current) },
      { upsert: true }
    ).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  getWhitelist(guildId) {
    return cache.whitelist.filter(w => w.guildId === guildId);
  },
  addWhitelist(guildId, targetId, type) {
    const exists = cache.whitelist.some(w => w.guildId === guildId && w.targetId === targetId && w.type === type);
    if (!exists) {
      const newDoc = { guildId, targetId, type };
      cache.whitelist.push(newDoc);
      mongoDb.collection('whitelist').insertOne(newDoc).catch(() => null);
    }
    return { changes: 1 };
  },
  removeWhitelist(guildId, targetId) {
    cache.whitelist = cache.whitelist.filter(w => !(w.guildId === guildId && w.targetId === targetId));
    mongoDb.collection('whitelist').deleteMany({ guildId, targetId }).catch(console.error);
    return { changes: 1 };
  },
  addBlacklist(guildId, targetId, type) {
    const exists = cache.blacklist.some(b => b.guildId === guildId && b.targetId === targetId && b.type === type);
    if (!exists) {
      const newDoc = { guildId, targetId, type };
      cache.blacklist.push(newDoc);
      mongoDb.collection('blacklist').insertOne(newDoc).catch(() => null);
    }
    return { changes: 1 };
  },
  removeBlacklist(guildId, targetId) {
    cache.blacklist = cache.blacklist.filter(b => !(b.guildId === guildId && b.targetId === targetId));
    mongoDb.collection('blacklist').deleteMany({ guildId, targetId }).catch(console.error);
    return { changes: 1 };
  },
  isWhitelisted(guildId, targetId) {
    return cache.whitelist.some(w => w.guildId === guildId && w.targetId === targetId);
  },

  getInvites(userId, guildId) {
    let row = cache.invites.get(`${userId}_${guildId}`);
    if (!row) {
      row = { userId, guildId, total: 0, fake: 0, left: 0, bonus: 0 };
      cache.invites.set(`${userId}_${guildId}`, row);
      mongoDb.collection('invites').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateInvites(userId, guildId, field, value) {
    const allowed = ['total', 'fake', 'left', 'bonus'];
    if (!allowed.includes(field)) throw new Error(`Invalid invite field: ${field}`);

    let doc = cache.invites.get(`${userId}_${guildId}`);
    if (!doc) doc = { userId, guildId, total: 0, fake: 0, left: 0, bonus: 0 };
    doc[field] = (doc[field] || 0) + value;
    cache.invites.set(`${userId}_${guildId}`, doc);
    mongoDb.collection('invites').updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
  },
  resetInvites(userId, guildId) {
    let doc = cache.invites.get(`${userId}_${guildId}`);
    if (doc) {
      doc.total = 0; doc.fake = 0; doc.left = 0; doc.bonus = 0;
      cache.invites.set(`${userId}_${guildId}`, doc);
      mongoDb.collection('invites').updateOne({ userId, guildId }, { $set: { total: 0, fake: 0, left: 0, bonus: 0 } }).catch(console.error);
    }
  },
  resetAllInvites(guildId) {
    for (const val of cache.invites.values()) {
      if (val.guildId === guildId) {
        val.total = 0; val.fake = 0; val.left = 0; val.bonus = 0;
      }
    }
    mongoDb.collection('invites').updateMany({ guildId }, { $set: { total: 0, fake: 0, left: 0, bonus: 0 } }).catch(console.error);
  },
  getInviteRanks(guildId) {
    return cache.invite_ranks.filter(r => r.guildId === guildId).sort((a, b) => a.count - b.count);
  },
  addInviteRank(guildId, count, roleId) {
    cache.invite_ranks = cache.invite_ranks.filter(r => !(r.guildId === guildId && r.count === count));
    mongoDb.collection('invite_ranks').deleteMany({ guildId, count }).catch(() => null);

    const newDoc = { guildId, count, roleId };
    cache.invite_ranks.push(newDoc);
    mongoDb.collection('invite_ranks').insertOne(newDoc).catch(console.error);
    return { changes: 1 };
  },
  getInviteLogs(guildId) {
    return cache.invite_logs.get(guildId);
  },

  getTicketSettings(guildId) {
    let row = cache.ticket_settings.get(guildId);
    if (!row) {
      row = {
        guildId, category_id: null, log_channel: null, staff_role: null, panel_channel: null,
        feedbacks_channel: null,
        owners_role: null,
        support_message: 'Click the button below to open a ticket!',
        ticket_message: 'Thank you for opening a ticket! Support will be with you shortly.', panel_data: {}
      };
      cache.ticket_settings.set(guildId, row);
      mongoDb.collection('ticket_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateTicketSettings(guildId, data) {
    let current = this.getTicketSettings(guildId);
    if (data.category_id !== undefined) current.category_id = data.category_id;
    if (data.log_channel !== undefined) current.log_channel = data.log_channel;
    if (data.feedbacks_channel !== undefined ) current.feedbacks_channel = data.feedbacks_channel;
    if (data.owners_role !== undefined) current.owners_role = data.owners_role;
    if (data.staff_role !== undefined) current.staff_role = data.staff_role;
    if (data.panel_channel !== undefined) current.panel_channel = data.panel_channel;
    if (data.support_message !== undefined) current.support_message = data.support_message;
    if (data.ticket_message !== undefined) current.ticket_message = data.ticket_message;
    if (data.panel_data !== undefined) current.panel_data = typeof data.panel_data === 'string' ? JSON.parse(data.panel_data) : data.panel_data;

    cache.ticket_settings.set(guildId, current);
    return mongoDb.collection('ticket_settings').updateOne({ guildId }, { $set: stripId(current) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  createTicket(guildId, userId, channelId, category) {
    const timestamp = Math.floor(Date.now() / 1000);
    const doc = { guildId, userId, channelId, status: 'open', category, created_at: timestamp };
    cache.tickets.push(doc);
    mongoDb.collection('tickets').insertOne(doc).catch(console.error);
    return { changes: 1 };
  },
  getTicketByChannel(channelId) {
    return cache.tickets.find(t => t.channelId === channelId);
  },
  updateTicketStatus(channelId, status) {
    const t = cache.tickets.find(tk => tk.channelId === channelId);
    if (t) {
      t.status = status;
      mongoDb.collection('tickets').updateOne({ channelId }, { $set: { status } }).catch(console.error);
    }
    return { changes: 1 };
  },
  claimTicket(channelId, userId) {
    const ticket = cache.tickets.find(t => t.channelId === channelId);

    if (!ticket) return false;

    ticket.claimedBy = userId;

    mongoDb.collection("tickets").updateOne(
        { channelId },
        { $set: { claimedBy: userId } }
    ).catch(console.error);

    return true;
},


addTicketBlacklist(guildId, userId) {

    const row = {
        guildId,
        userId,
        createdAt: Date.now()
    };

    cache.ticket_blacklist ??= [];
    cache.ticket_blacklist.push(row);

    return mongoDb
        .collection("ticket_blacklist")
        .insertOne(row);
},

removeTicketBlacklist(guildId, userId) {

    cache.ticket_blacklist =
        (cache.ticket_blacklist || [])
        .filter(
            x =>
                !(
                    x.guildId === guildId &&
                    x.userId === userId
                )
        );

    return mongoDb
        .collection("ticket_blacklist")
        .deleteOne({
            guildId,
            userId
        });
},

isTicketBlacklisted(guildId, userId) {

    return (cache.ticket_blacklist || [])
        .some(
            x =>
                x.guildId === guildId &&
                x.userId === userId
        );
},


addTicketWarning(guildId, userId, moderatorId, reason) {

    const row = {
        guildId,
        userId,
        moderatorId,
        reason,
        createdAt: Date.now()
    };

    cache.ticket_warnings ??= [];
    cache.ticket_warnings.push(row);

    return mongoDb
        .collection("ticket_warnings")
        .insertOne(row);
},

getTicketWarnings(guildId, userId) {

    return (cache.ticket_warnings || [])
        .filter(
            x =>
                x.guildId === guildId &&
                x.userId === userId
        );
},





  getAutoReplies(guildId) {
    return cache.auto_reply.filter(a => a.guildId === guildId);
  },
  addAutoReply(guildId, trigger, response, deleteTrigger = 0) {
    const doc = { guildId, trigger, response, deleteTrigger: Number(deleteTrigger) };
    cache.auto_reply.push(doc);
    mongoDb.collection('auto_reply').insertOne(doc).catch(console.error);
    return { changes: 1 };
  },
  removeAutoReply(guildId, trigger) {
    cache.auto_reply = cache.auto_reply.filter(a => !(a.guildId === guildId && a.trigger === trigger));
    mongoDb.collection('auto_reply').deleteMany({ guildId, trigger }).catch(console.error);
    return { changes: 1 };
  },

  setSnipe(channelId, content, authorId, authorTag, authorAvatar) {
    const now = Math.floor(Date.now() / 1000);
    const doc = { channelId, content, authorId, authorTag, authorAvatar, timestamp: now };
    cache.snipe.set(channelId, doc);
    mongoDb.collection('snipe').updateOne({ channelId }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
  },
  getSnipe(channelId) {
    return cache.snipe.get(channelId);
  },

  getLogSettings(guildId) {
    let row = cache.log_settings.get(guildId);
    if (!row) {
      row = {
        guildId, ban_channel: null, unban_channel: null, kick_channel: null, timeout_channel: null, warn_channel: null,
        message_delete_channel: null, message_edit_channel: null, member_join_channel: null, member_leave_channel: null,
        channel_create_channel: null, channel_delete_channel: null, role_create_channel: null, role_delete_channel: null, nick_change_channel: null
      };
      cache.log_settings.set(guildId, row);
      mongoDb.collection('log_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  setLogChannel(guildId, channelId) {
    this.setGuildSetting(guildId, 'log_channel', channelId);
    this.getLogSettings(guildId);
  },

  getAliases(guildId) {
    return cache.aliases.filter(a => a.guildId === guildId);
  },
  addAlias(guildId, shortcut, command) {
    const doc = { guildId, shortcut, command };
    cache.aliases.push(doc);
    mongoDb.collection('aliases').insertOne(doc).catch(console.error);
    return { changes: 1 };
  },
  removeAlias(guildId, shortcut) {
    cache.aliases = cache.aliases.filter(a => !(a.guildId === guildId && a.shortcut === shortcut));
    mongoDb.collection('aliases').deleteMany({ guildId, shortcut }).catch(console.error);
    return { changes: 1 };
  },

  getFormsSettings(guildId) {
    let row = cache.forms_settings.get(guildId);
    if (!row) {
      row = { guildId, log_channel: null, panel_data: {}, questions: [] };
      cache.forms_settings.set(guildId, row);
      mongoDb.collection('forms_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateFormsSettings(guildId, data) {
    let current = this.getFormsSettings(guildId);
    if (data.log_channel !== undefined) current.log_channel = data.log_channel;
    if (data.panel_data !== undefined) current.panel_data = typeof data.panel_data === 'string' ? JSON.parse(data.panel_data) : data.panel_data;
    if (data.questions !== undefined) current.questions = typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions;

    cache.forms_settings.set(guildId, current);
    return mongoDb.collection('forms_settings').updateOne({ guildId }, { $set: stripId(current) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },

  getReactionRoles(guildId) {
    let row = cache.reaction_roles.get(guildId);
    if (!row) {
      row = { guildId, panel_data: {}, roles_data: [] };
      cache.reaction_roles.set(guildId, row);
      mongoDb.collection('reaction_roles').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateReactionRoles(guildId, data) {
    let current = this.getReactionRoles(guildId);
    if (data.panel_data !== undefined) current.panel_data = typeof data.panel_data === 'string' ? JSON.parse(data.panel_data) : data.panel_data;
    if (data.roles_data !== undefined) current.roles_data = typeof data.roles_data === 'string' ? JSON.parse(data.roles_data) : data.roles_data;

    cache.reaction_roles.set(guildId, current);
    return mongoDb.collection('reaction_roles').updateOne({ guildId }, { $set: stripId(current) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },

  getCaptchaSettings(guildId) {
    let row = cache.captcha_settings.get(guildId);
    if (!row) {
      row = { guildId, enabled: 0, unverified_role: null, verified_role: null, panel_channel: null, panel_data: {} };
      cache.captcha_settings.set(guildId, row);
      mongoDb.collection('captcha_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateCaptchaSettings(guildId, data) {
    let current = this.getCaptchaSettings(guildId);
    if (data.enabled !== undefined) current.enabled = data.enabled;
    if (data.unverified_role !== undefined) current.unverified_role = data.unverified_role;
    if (data.verified_role !== undefined) current.verified_role = data.verified_role;
    if (data.panel_channel !== undefined) current.panel_channel = data.panel_channel;
    if (data.panel_data !== undefined) current.panel_data = typeof data.panel_data === 'string' ? JSON.parse(data.panel_data) : data.panel_data;

    cache.captcha_settings.set(guildId, current);
    return mongoDb.collection('captcha_settings').updateOne({ guildId }, { $set: stripId(current) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },

  getTempVoiceSettings(guildId) {
    let row = cache.tempvoice_settings.get(guildId);
    if (!row) {
      row = { guildId, master_channel: null, category_id: null, panel_channel: null };
      cache.tempvoice_settings.set(guildId, row);
      mongoDb.collection('tempvoice_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateTempVoiceSettings(guildId, master_channel, category_id) {
    let doc = cache.tempvoice_settings.get(guildId) || { guildId };
    doc.master_channel = master_channel;
    doc.category_id = category_id;
    cache.tempvoice_settings.set(guildId, doc);
    return mongoDb.collection('tempvoice_settings').updateOne({ guildId }, { $set: { master_channel, category_id } }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  updateTempVoicePanel(guildId, panel_channel) {
    let doc = cache.tempvoice_settings.get(guildId) || { guildId };
    doc.panel_channel = panel_channel;
    cache.tempvoice_settings.set(guildId, doc);
    return mongoDb.collection('tempvoice_settings').updateOne({ guildId }, { $set: { panel_channel } }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },

  getJailSettings(guildId) {
    let row = cache.jail_settings.get(guildId);
    if (!row) {
      row = { guildId, jailRoleId: null, jailChannelId: null, staffVoiceId: null };
      cache.jail_settings.set(guildId, row);
      mongoDb.collection('jail_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  setJailSettings(guildId, roleId, channelId, staffVoiceId) {
    const doc = { guildId, jailRoleId: roleId, jailChannelId: channelId, staffVoiceId };
    cache.jail_settings.set(guildId, doc);
    return mongoDb.collection('jail_settings').updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  getJailedUser(userId, guildId) {
    return cache.jailed_users.get(`${userId}_${guildId}`);
  },
  addJailedUser(userId, guildId, oldRoles) {
    const now = Math.floor(Date.now() / 1000);
    const doc = { userId, guildId, oldRoles, jailedAt: now };
    cache.jailed_users.set(`${userId}_${guildId}`, doc);
    return mongoDb.collection('jailed_users').updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  removeJailedUser(userId, guildId) {
    cache.jailed_users.delete(`${userId}_${guildId}`);
    return mongoDb.collection('jailed_users').deleteOne({ userId, guildId }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },

  addTempVoiceChannel(channelId, ownerId, guildId) {
    const doc = { channelId, ownerId, guildId };
    cache.tempvoice_channels.set(channelId, doc);
    return mongoDb.collection('tempvoice_channels').insertOne(doc).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  getTempVoiceChannel(channelId) {
    return cache.tempvoice_channels.get(channelId);
  },
  removeTempVoiceChannel(channelId) {
    cache.tempvoice_channels.delete(channelId);
    return mongoDb.collection('tempvoice_channels').deleteOne({ channelId }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  getTempVoiceChannelsByGuild(guildId) {
    return Array.from(cache.tempvoice_channels.values()).filter(c => c.guildId === guildId);
  },

  getBotSettings() {
    let row = cache.bot_settings.get(1);
    if (!row) {
      row = { id: 1, status: 'online', activity_type: 'PLAYING', activity_name: 'E-246 System' };
      cache.bot_settings.set(1, row);
      mongoDb.collection('bot_settings').insertOne(row).catch(() => null);
    }
    return row;
  },
  updateBotSettings(status, activity_type, activity_name, emoji_color, broadcast_tokens) {
    let doc = cache.bot_settings.get(1) || { id: 1 };
    doc.status = status; doc.activity_type = activity_type; doc.activity_name = activity_name; doc.emoji_color = emoji_color; doc.broadcast_tokens = broadcast_tokens;
    cache.bot_settings.set(1, doc);
    return mongoDb.collection('bot_settings').updateOne({ id: 1 }, { $set: { status, activity_type, activity_name, emoji_color, broadcast_tokens } }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },

  getTempVoiceUserSettings(userId) {
    return cache.tempvoice_user_settings.get(userId);
  },
  saveTempVoiceUserSettings(userId, name, limit) {
    const doc = { userId, preferredName: name, preferredLimit: limit };
    cache.tempvoice_user_settings.set(userId, doc);
    return mongoDb.collection('tempvoice_user_settings').updateOne({ userId }, { $set: stripId(doc) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },

  addTempVoiceBan(channelId, targetId) {
    const doc = { channelId, targetId };
    cache.tempvoice_bans.set(`${channelId}_${targetId}`, doc);
    return mongoDb.collection('tempvoice_bans').updateOne({ channelId, targetId }, { $set: stripId(doc) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  removeTempVoiceBan(channelId, targetId) {
    cache.tempvoice_bans.delete(`${channelId}_${targetId}`);
    return mongoDb.collection('tempvoice_bans').deleteOne({ channelId, targetId }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  isTempVoiceBanned(channelId, targetId) {
    return cache.tempvoice_bans.has(`${channelId}_${targetId}`);
  },
  getTempVoiceBans(channelId) {
    return Array.from(cache.tempvoice_bans.values()).filter(b => b.channelId === channelId);
  },

  addTempVoiceTrusted(channelId, userId) {
    const doc = { channelId, userId };
    cache.tempvoice_trusted.set(`${channelId}_${userId}`, doc);
    return mongoDb.collection('tempvoice_trusted').updateOne({ channelId, userId }, { $set: stripId(doc) }, { upsert: true }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  removeTempVoiceTrusted(channelId, userId) {
    cache.tempvoice_trusted.delete(`${channelId}_${userId}`);
    return mongoDb.collection('tempvoice_trusted').deleteOne({ channelId, userId }).then(() => ({ changes: 1 })).catch(() => ({ changes: 0 }));
  },
  isTempVoiceTrusted(channelId, userId) {
    return cache.tempvoice_trusted.has(`${channelId}_${userId}`);
  },
  getTempVoiceTrustedUsers(channelId) {
    return Array.from(cache.tempvoice_trusted.values()).filter(t => t.channelId === channelId);
  },

  incrementDailyJoins(guildId) {
    const today = new Date().toISOString().split('T')[0];
    let doc = cache.stats_daily_members.get(`${guildId}_${today}`);
    if (!doc) { doc = { guildId, date: today, joins: 1, leaves: 0 }; } else { doc.joins = (doc.joins || 0) + 1; }
    cache.stats_daily_members.set(`${guildId}_${today}`, doc);
    mongoDb.collection('stats_daily_members').updateOne({ guildId, date: today }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  },
  incrementDailyLeaves(guildId) {
    const today = new Date().toISOString().split('T')[0];
    let doc = cache.stats_daily_members.get(`${guildId}_${today}`);
    if (!doc) { doc = { guildId, date: today, joins: 0, leaves: 1 }; } else { doc.leaves = (doc.leaves || 0) + 1; }
    cache.stats_daily_members.set(`${guildId}_${today}`, doc);
    mongoDb.collection('stats_daily_members').updateOne({ guildId, date: today }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  },
  incrementHourlyMessages(guildId) {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    let doc = cache.stats_hourly_messages.get(`${guildId}_${today}_${hour}`);
    if (!doc) { doc = { guildId, date: today, hour, message_count: 1 }; } else { doc.message_count = (doc.message_count || 0) + 1; }
    cache.stats_hourly_messages.set(`${guildId}_${today}_${hour}`, doc);
    mongoDb.collection('stats_hourly_messages').updateOne({ guildId, date: today, hour }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  },
  addDailyVoiceSeconds(guildId, seconds) {
    const today = new Date().toISOString().split('T')[0];
    let doc = cache.stats_daily_voice.get(`${guildId}_${today}`);
    if (!doc) { doc = { guildId, date: today, seconds }; } else { doc.seconds = (doc.seconds || 0) + seconds; }
    cache.stats_daily_voice.set(`${guildId}_${today}`, doc);
    mongoDb.collection('stats_daily_voice').updateOne({ guildId, date: today }, { $set: stripId(doc) }, { upsert: true }).catch(console.error);
    return { changes: 1 };
  },

  getDailyMembersStats(guildId, daysCount = 7) {
    return Array.from(cache.stats_daily_members.values())
      .filter(s => s.guildId === guildId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, daysCount)
      .reverse();
  },
  getHourlyMessagesStats(guildId) {
    const statsMap = {};
    for (const val of cache.stats_hourly_messages.values()) {
      if (val.guildId === guildId) { statsMap[val.hour] = (statsMap[val.hour] || 0) + (val.message_count || 0); }
    }
    return Object.keys(statsMap).map(h => ({ hour: parseInt(h), count: statsMap[h] })).sort((a, b) => a.hour - b.hour);
  },
  getDailyVoiceStats(guildId, daysCount = 7) {
    return Array.from(cache.stats_daily_voice.values())
      .filter(s => s.guildId === guildId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, daysCount)
      .reverse();
  },

  getSocialAlerts(guildId) {
    return cache.social_alerts.filter(a => a.guildId === guildId);
  },
  getAllSocialAlerts() {
    return cache.social_alerts;
  },
  addSocialAlert(guildId, platform, channelId, socialId, message) {
    const doc = { id: Date.now().toString(36), guildId, platform, channelId, socialId, lastVideoId: null, message };
    cache.social_alerts.push(doc);
    mongoDb.collection('social_alerts').insertOne(doc).catch(console.error);
    return { changes: 1 };
  },
  removeSocialAlert(id, guildId) {
    cache.social_alerts = cache.social_alerts.filter(a => !(a.id === id && a.guildId === guildId));
    mongoDb.collection('social_alerts').deleteOne({ id, guildId }).catch(console.error);
    return { changes: 1 };
  },
  updateSocialAlertLastVideo(id, lastVideoId) {
    const idx = cache.social_alerts.findIndex(a => a.id === id);
    if (idx !== -1) {
      cache.social_alerts[idx].lastVideoId = lastVideoId;
      mongoDb.collection('social_alerts').updateOne({ id }, { $set: { lastVideoId } }).catch(console.error);
    }
    return { changes: 1 };
  },
  updateSocialAlertSocialId(id, socialId) {
    const idx = cache.social_alerts.findIndex(a => a.id === id);
    if (idx !== -1) {
      cache.social_alerts[idx].socialId = socialId;
      mongoDb.collection('social_alerts').updateOne({ id }, { $set: { socialId } }).catch(console.error);
    }
    return { changes: 1 };
  },
  saveMessage(messageId, channelId, guildId, authorId, authorTag, authorAvatar, content, attachments) {
    const doc = {
      messageId,
      channelId,
      guildId,
      authorId,
      authorTag,
      authorAvatar,
      content,
      attachments,
      createdAt: new Date()
    };
    mongoDb.collection('message_cache').insertOne(doc).catch(() => {});
  },
  async getKV(key) {
    if (!mongoDb) return null;
    const doc = await mongoDb.collection('quick_db').findOne({ key }).catch(() => null);
    return doc ? doc.value : null;
  },
  async setKV(key, value) {
    if (!mongoDb) return value;
    await mongoDb.collection('quick_db').updateOne({ key }, { $set: { value } }, { upsert: true }).catch(() => {});
    return value;
  },
  async deleteKV(key) {
    if (!mongoDb) return false;
    await mongoDb.collection('quick_db').deleteOne({ key }).catch(() => {});
    return true;
  },
  async getTopBalances(limit = 6) {
    if (!mongoDb) return [];
    const docs = await mongoDb.collection('quick_db').find({ key: { $regex: /^balance_/ } }).toArray().catch(() => []);
    return docs.map(d => ({
      userId: d.key.replace('balance_', ''),
      balance: d.value
    })).sort((a, b) => b.balance - a.balance).slice(0, limit);
  }
};

helpers.stripId = stripId;
helpers.safeSet = safeSet;
helpers.prepare = (sql) => helpers.db.prepare(sql);
module.exports = helpers;
