const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/e246';
const client = new MongoClient(mongoUri, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
});

client.on('error', (err) => logger.error('[MongoDB Connection Error]', err));
client.on('close', () => logger.warn('[MongoDB Connection Closed]'));
client.on('reconnect', () => logger.info('✅ [MongoDB Reconnected]'));
client.on('topologyDescriptionChanged', () => {});

let mongoDb = null;
let isConnected = false;
let connectionAttempted = false;

function safeCollection(name) {
  if (!mongoDb) {
    if (!connectionAttempted) {
      logger.warn('[MongoDB] safeCollection called before connection attempt — returning mock');
    } else if (!isConnected) {
      logger.warn('[MongoDB] safeCollection called while disconnected — returning mock');
    }
    return {
      insertOne: () => Promise.resolve({ acknowledged: true, insertedId: null }),
      updateOne: () => Promise.resolve({ acknowledged: true, modifiedCount: 0 }),
      updateMany: () => Promise.resolve({ acknowledged: true, modifiedCount: 0 }),
      deleteMany: () => Promise.resolve({ acknowledged: true, deletedCount: 0 }),
      deleteOne: () => Promise.resolve({ acknowledged: true, deletedCount: 0 }),
      findOne: () => Promise.resolve(null),
      find: () => ({ toArray: () => Promise.resolve([]) }),
      createIndex: () => Promise.resolve(null),
      countDocuments: () => Promise.resolve(0)
    };
  }
  return mongoDb.collection(name);
}

const cache = {
  guild_settings: new Map(),
  warnings: [],
  levels: new Map(),
  level_settings: new Map(),
  greet_settings: new Map(),
  feelings_settings: new Map(),
  boost_settings: new Map(),
  bank_settings: new Map(),
  active_games: new Map(),
  command_restrictions: [],
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
  ticket_categories: [],
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
  social_alerts: [],
  automod_settings: new Map(),
  custom_commands: [],
  mod_actions: [],
  suggestion_settings: new Map(),
  suggestions: new Map(),
  afk_users: new Map(),
  starboard_settings: new Map(),
  starboard_posts: new Map(),
  sticky_messages: new Map(),
  form_submissions: [],
  booster_roles: new Map(),
  shop_roles: new Map(),
  shop_transactions: [],
  daily_quests: new Map(),
  sticky_roles: new Map(),
  sticky_role_settings: new Map(),
  ticket_ratings: [],
  canned_responses: [],
  ticket_transcripts: new Map(),
  streak_settings: new Map(),
  user_streaks: new Map(),
  theme_color: []
};

const unhandledSqlStatements = [];

function stripId(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return doc;
  const out = { ...doc };
  delete out._id;
  return out;
}

function safeSet(doc) {
  return { $set: stripId(doc) };
}

function safeJsonParse(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

async function loadMongoCache() {
  if (!mongoDb) {
    logger.warn('[MongoDB] loadMongoCache skipped — no active connection');
    return;
  }
  const collections = await mongoDb.collections();
  const names = collections.map((c) => c.collectionName);

  const mapCollections = [
    { name: 'guild_settings', key: (d) => d.guildId },
    { name: 'levels', key: (d) => `${d.userId}_${d.guildId}` },
    { name: 'level_settings', key: (d) => d.guildId },
    { name: 'greet_settings', key: (d) => d.guildId },
    { name: 'feelings_settings', key: (d) => d.guildId },
    { name: 'boost_settings', key: (d) => d.guildId },
    { name: 'bank_settings', key: (d) => d.guildId },
    { name: 'active_games', key: (d) => d.channelId },
    { name: 'giveaways', key: (d) => d.messageId },
    { name: 'protection_settings', key: (d) => d.guildId },
    { name: 'invites', key: (d) => `${d.userId}_${d.guildId}` },
    { name: 'invite_uses', key: (d) => `${d.code}_${d.guildId}` },
    { name: 'invite_logs', key: (d) => d.guildId },
    { name: 'ticket_settings', key: (d) => d.guildId },
    { name: 'reaction_roles', key: (d) => d.guildId },
    { name: 'forms_settings', key: (d) => d.guildId },
    { name: 'captcha_settings', key: (d) => d.guildId },
    { name: 'log_settings', key: (d) => d.guildId },
    { name: 'tempvoice_settings', key: (d) => d.guildId },
    { name: 'jailed_users', key: (d) => `${d.userId}_${d.guildId}` },
    { name: 'jail_settings', key: (d) => d.guildId },
    { name: 'tempvoice_channels', key: (d) => d.channelId },
    { name: 'bot_settings', key: (d) => d.id || 1 },
    { name: 'tempvoice_user_settings', key: (d) => d.userId },
    { name: 'tempvoice_bans', key: (d) => `${d.channelId}_${d.targetId}` },
    { name: 'tempvoice_trusted', key: (d) => `${d.channelId}_${d.userId}` },
    { name: 'stats_daily_members', key: (d) => `${d.guildId}_${d.date}` },
    { name: 'stats_hourly_messages', key: (d) => `${d.guildId}_${d.date}_${d.hour}` },
    { name: 'stats_daily_voice', key: (d) => `${d.guildId}_${d.date}` },
    { name: 'snipe', key: (d) => d.channelId },
    { name: 'automod_settings', key: (d) => d.guildId },
    { name: 'suggestion_settings', key: (d) => d.guildId },
    { name: 'suggestions', key: (d) => d.messageId },
    { name: 'afk_users', key: (d) => `${d.userId}_${d.guildId}` },
    { name: 'starboard_settings', key: (d) => d.guildId },
    { name: 'starboard_posts', key: (d) => d.originalMessageId },
    { name: 'sticky_messages', key: (d) => d.channelId },
    { name: 'booster_roles', key: (d) => `${d.guildId}_${d.userId}` },
    { name: 'shop_roles', key: (d) => `${d.guildId}_${d.roleId}` },
    { name: 'daily_quests', key: (d) => `${d.userId}_${d.date}` },
    { name: 'sticky_roles', key: (d) => `${d.guildId}_${d.userId}` },
    { name: 'sticky_role_settings', key: (d) => d.guildId },
    { name: 'ticket_transcripts', key: (d) => d.channelId },
    { name: 'streak_settings', key: (d) => d.guildId },
    { name: 'user_streaks', key: (d) => `${d.guildId}_${d.userId}` }
  ];

  const arrayCollections = [
    'warnings',
    'automation',
    'whitelist',
    'blacklist',
    'invite_ranks',
    'tickets',
    'auto_reply',
    'reactroles',
    'aliases',
    'social_alerts',
    'ticket_blacklist',
    'ticket_warnings',
    'custom_commands',
    'ticket_categories',
    'command_restrictions',
    'mod_actions',
    'form_submissions',
    'theme_color',
    'shop_transactions',
    'ticket_ratings',
    'canned_responses'
  ];

  for (const col of mapCollections) {
    if (names.includes(col.name)) {
      const data = await safeCollection(col.name).find({}).toArray();
      for (const doc of data) {
        cache[col.name].set(col.key(doc), doc);
      }
    }
  }

  for (const name of arrayCollections) {
    if (names.includes(name)) {
      const data = await safeCollection(name).find({}).toArray();
      cache[name].push(...data);
    }
  }

  logger.info('[MongoDB] In-memory cache loaded successfully');
}

async function connect() {
  if (connectionAttempted) {
    if (isConnected) return;
    throw new Error('MongoDB connection already attempted and failed');
  }
  connectionAttempted = true;

  try {
    await client.connect();

    // Verify connection by pinging
    await client.db('admin').command({ ping: 1 });

    const dbName =
      client.options?.dbName || client.options?.databaseName || mongoUri.split('/').pop().split('?')[0] || 'e246';
    mongoDb = client.db(dbName);
    if (!mongoDb) throw new Error('MongoDB client.db() returned null — check your connection string');

    isConnected = true;
    logger.info('✅ [MongoDB] Connected successfully to database');

    await safeCollection('message_cache')
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 259200 })
      .catch(() => {});

    await loadMongoCache();
  } catch (error) {
    connectionAttempted = true;
    isConnected = false;
    logger.error('❌ [MongoDB] Connection failed:', error.message);
    throw error;
  }
}

function translateSql(opType, sql, args) {
  if (!mongoDb) {
    logger.error('[DB] translateSql called before MongoDB was connected');
    return opType === 'get' ? null : { changes: 0 };
  }
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  if (/UPDATE log_settings SET (\w+) = \? WHERE guildId = \?/i.test(cleanSql)) {
    const colName = cleanSql.match(/UPDATE log_settings SET (\w+) = \? WHERE guildId = \?/i)[1];
    const [value, guildId] = args;
    const doc = cache.log_settings.get(guildId) || { guildId };
    doc[colName] = value;
    cache.log_settings.set(guildId, doc);
    safeCollection('log_settings')
      .updateOne({ guildId }, { $set: { [colName]: value } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/INSERT OR REPLACE INTO reactroles/i.test(cleanSql)) {
    const [messageId, guildId, emoji, roleId] = args;
    const idx = cache.reactroles.findIndex((r) => r.messageId === messageId && r.emoji === emoji);
    const newDoc = { messageId, guildId, emoji, roleId };
    if (idx !== -1) {
      cache.reactroles[idx] = newDoc;
    } else {
      cache.reactroles.push(newDoc);
    }
    safeCollection('reactroles')
      .updateOne({ messageId, emoji }, { $set: stripId(newDoc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET channel = \?, enabled = 1 WHERE guildId = \?/i.test(cleanSql)) {
    const [channel, guildId] = args;
    const doc = cache.greet_settings.get(guildId) || { guildId };
    doc.channel = channel;
    doc.enabled = 1;
    cache.greet_settings.set(guildId, doc);
    safeCollection('greet_settings')
      .updateOne({ guildId }, { $set: { channel, enabled: 1 } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET delete_after = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [delete_after, guildId] = args;
    const doc = cache.greet_settings.get(guildId) || { guildId };
    doc.delete_after = delete_after;
    cache.greet_settings.set(guildId, doc);
    safeCollection('greet_settings')
      .updateOne({ guildId }, { $set: { delete_after } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET dm_message = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [dm_message, guildId] = args;
    const doc = cache.greet_settings.get(guildId) || { guildId };
    doc.dm_message = dm_message;
    cache.greet_settings.set(guildId, doc);
    safeCollection('greet_settings')
      .updateOne({ guildId }, { $set: { dm_message } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE greet_settings SET message = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [message, guildId] = args;
    const doc = cache.greet_settings.get(guildId) || { guildId };
    doc.message = message;
    cache.greet_settings.set(guildId, doc);
    safeCollection('greet_settings')
      .updateOne({ guildId }, { $set: { message } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/INSERT INTO invite_logs/i.test(cleanSql)) {
    const [guildId, channelId] = args;
    cache.invite_logs.set(guildId, { guildId, channelId });
    safeCollection('invite_logs')
      .updateOne({ guildId }, { $set: { channelId } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET enabled = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [enabled, guildId] = args;
    const doc = cache.level_settings.get(guildId) || { guildId };
    doc.enabled = enabled;
    cache.level_settings.set(guildId, doc);
    safeCollection('level_settings')
      .updateOne({ guildId }, { $set: { enabled } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET channel = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [channel, guildId] = args;
    const doc = cache.level_settings.get(guildId) || { guildId };
    doc.channel = channel;
    cache.level_settings.set(guildId, doc);
    safeCollection('level_settings')
      .updateOne({ guildId }, { $set: { channel } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET xp_min = \?, xp_max = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [xp_min, xp_max, guildId] = args;
    const doc = cache.level_settings.get(guildId) || { guildId };
    doc.xp_min = xp_min;
    doc.xp_max = xp_max;
    cache.level_settings.set(guildId, doc);
    safeCollection('level_settings')
      .updateOne({ guildId }, { $set: { xp_min, xp_max } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE level_settings SET xp_cooldown = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [xp_cooldown, guildId] = args;
    const doc = cache.level_settings.get(guildId) || { guildId };
    doc.xp_cooldown = xp_cooldown;
    cache.level_settings.set(guildId, doc);
    safeCollection('level_settings')
      .updateOne({ guildId }, { $set: { xp_cooldown } }, { upsert: true })
      .catch((err) => logger.error(err));
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
    const doc = cache.level_settings.get(guildId) || { guildId };
    doc.role_rewards = rewards;
    cache.level_settings.set(guildId, doc);
    safeCollection('level_settings')
      .updateOne({ guildId }, { $set: { role_rewards: rewards } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/INSERT INTO protection_settings \(guildId\) VALUES \(\?\) ON CONFLICT\(guildId\) DO NOTHING/i.test(cleanSql)) {
    const [guildId] = args;
    if (!cache.protection_settings.has(guildId)) {
      const newDoc = { guildId, enabled: 0 };
      cache.protection_settings.set(guildId, newDoc);
      safeCollection('protection_settings')
        .insertOne(newDoc)
        .catch(() => null);
    }
    return { changes: 1 };
  }

  if (
    /UPDATE protection_settings SET (\w+) = \?, bypass_role = COALESCE\(\?, bypass_role\) WHERE guildId = \?/i.test(
      cleanSql
    )
  ) {
    const match = cleanSql.match(
      /UPDATE protection_settings SET (\w+) = \?, bypass_role = COALESCE\(\?, bypass_role\) WHERE guildId = \?/i
    );
    const colName = match[1];
    const [val, bypass, guildId] = args;
    const doc = cache.protection_settings.get(guildId) || { guildId };
    doc[colName] = val;
    if (bypass !== null) doc.bypass_role = bypass;
    cache.protection_settings.set(guildId, doc);
    const updateObj = { [colName]: val };
    if (bypass !== null) updateObj.bypass_role = bypass;
    safeCollection('protection_settings')
      .updateOne({ guildId }, { $set: updateObj }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET (\w+) = \? WHERE guildId = \?/i.test(cleanSql)) {
    const match = cleanSql.match(/UPDATE protection_settings SET (\w+) = \? WHERE guildId = \?/i);
    const colName = match[1];
    const [val, guildId] = args;
    const doc = cache.protection_settings.get(guildId) || { guildId };
    doc[colName] = val;
    cache.protection_settings.set(guildId, doc);
    safeCollection('protection_settings')
      .updateOne({ guildId }, { $set: { [colName]: val } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET enabled = 1 WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    const doc = cache.protection_settings.get(guildId) || { guildId };
    doc.enabled = 1;
    cache.protection_settings.set(guildId, doc);
    safeCollection('protection_settings')
      .updateOne({ guildId }, { $set: { enabled: 1 } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET enabled = 0 WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    const doc = cache.protection_settings.get(guildId) || { guildId };
    doc.enabled = 0;
    cache.protection_settings.set(guildId, doc);
    safeCollection('protection_settings')
      .updateOne({ guildId }, { $set: { enabled: 0 } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE protection_settings SET action = \? WHERE guildId = \?/i.test(cleanSql)) {
    const [action, guildId] = args;
    const doc = cache.protection_settings.get(guildId) || { guildId };
    doc.action = action;
    cache.protection_settings.set(guildId, doc);
    safeCollection('protection_settings')
      .updateOne({ guildId }, { $set: { action: action } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/INSERT INTO ticket_settings/i.test(cleanSql)) {
    const [guildId, category_id, staff_role, log_channel, ticket_message] = args;
    const doc = cache.ticket_settings.get(guildId) || { guildId };
    doc.category_id = category_id;
    doc.staff_role = staff_role;
    if (log_channel !== null) doc.log_channel = log_channel;
    if (ticket_message !== null) doc.ticket_message = ticket_message;
    cache.ticket_settings.set(guildId, doc);
    const updateObj = { category_id, staff_role };
    if (log_channel !== null) updateObj.log_channel = log_channel;
    if (ticket_message !== null) updateObj.ticket_message = ticket_message;
    safeCollection('ticket_settings')
      .updateOne({ guildId }, { $set: updateObj }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/SELECT \* FROM reactroles WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    return cache.reactroles.filter((r) => r.guildId === guildId);
  }

  if (/SELECT \* FROM reactroles WHERE messageId = \? AND emoji = \?/i.test(cleanSql)) {
    const [messageId, emoji] = args;
    return cache.reactroles.find((r) => r.messageId === messageId && r.emoji === emoji) || null;
  }

  if (/SELECT \* FROM levels WHERE guildId = \? ORDER BY messages DESC LIMIT 10/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.levels.values())
      .filter((u) => u.guildId === guildId)
      .sort((a, b) => (b.messages || 0) - (a.messages || 0))
      .slice(0, 10);
  }

  if (/SELECT \* FROM levels WHERE guildId = \? ORDER BY voice_xp DESC LIMIT 10/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.levels.values())
      .filter((u) => u.guildId === guildId)
      .sort((a, b) => (b.voice_xp || 0) - (a.voice_xp || 0))
      .slice(0, 10);
  }

  if (/SELECT \* FROM levels WHERE guildId = \? ORDER BY reactionsCount DESC LIMIT 10/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.levels.values())
      .filter((u) => u.guildId === guildId)
      .sort((a, b) => (b.reactionsCount || 0) - (a.reactionsCount || 0))
      .slice(0, 10);
  }

  if (/DELETE FROM reactroles WHERE guildId = \? AND messageId = \? AND emoji = \?/i.test(cleanSql)) {
    const [guildId, messageId, emoji] = args;
    const idx = cache.reactroles.findIndex(
      (r) => r.guildId === guildId && r.messageId === messageId && r.emoji === emoji
    );
    if (idx !== -1) cache.reactroles.splice(idx, 1);
    safeCollection('reactroles')
      .deleteOne({ guildId, messageId, emoji })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/SELECT \* FROM invites WHERE guildId = \?/i.test(cleanSql)) {
    const [guildId] = args;
    return Array.from(cache.invites.values()).filter((i) => i.guildId === guildId);
  }

  if (/SELECT \* FROM tickets WHERE guildId = \? AND userId = \? AND status = 'open'/i.test(cleanSql)) {
    const [guildId, userId] = args;
    return cache.tickets.find((t) => t.guildId === guildId && t.userId === userId && t.status === 'open');
  }

  if (/INSERT INTO level_settings/i.test(cleanSql)) {
    const [guildId, enabled, channel, xp_min, xp_max] = args.slice(0, 5);
    const doc = cache.level_settings.get(guildId) || { guildId };
    doc.enabled = enabled;
    doc.channel = channel;
    doc.xp_min = xp_min;
    doc.xp_max = xp_max;
    cache.level_settings.set(guildId, doc);
    safeCollection('level_settings')
      .updateOne({ guildId }, { $set: { enabled, channel, xp_min, xp_max } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/INSERT INTO greet_settings/i.test(cleanSql)) {
    const [
      guildId,
      enabled,
      channel,
      messageText,
      image_url,
      avatar_x,
      avatar_y,
      avatar_size,
      username_x,
      username_y,
      username_color,
      username_size
    ] = args.slice(0, 12);
    const doc = cache.greet_settings.get(guildId) || { guildId };
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
    safeCollection('greet_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch(() => null);
    return { changes: 1 };
  }

  if (/INSERT INTO protection_settings/i.test(cleanSql)) {
    const [guildId, enabled, ban_limit, kick_limit, action] = args.slice(0, 5);
    const doc = cache.protection_settings.get(guildId) || { guildId };
    doc.enabled = enabled;
    doc.ban_limit = ban_limit;
    doc.kick_limit = kick_limit;
    doc.action = action;
    cache.protection_settings.set(guildId, doc);
    safeCollection('protection_settings')
      .updateOne({ guildId }, { $set: { enabled, ban_limit, kick_limit, action } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/INSERT INTO log_settings/i.test(cleanSql)) {
    const [guildId, ...channelVals] = args.slice(0, 15);
    const cols = [
      'ban_channel',
      'unban_channel',
      'kick_channel',
      'timeout_channel',
      'warn_channel',
      'message_delete_channel',
      'message_edit_channel',
      'member_join_channel',
      'member_leave_channel',
      'channel_create_channel',
      'channel_delete_channel',
      'role_create_channel',
      'role_delete_channel',
      'nick_change_channel'
    ];
    const doc = cache.log_settings.get(guildId) || { guildId };
    for (let i = 0; i < cols.length; i++) {
      doc[cols[i]] = channelVals[i];
    }
    cache.log_settings.set(guildId, doc);
    safeCollection('log_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/SELECT \* FROM levels WHERE userId = \? AND guildId = \?/i.test(cleanSql)) {
    const [userId, guildId] = args;
    return cache.levels.get(`${userId}_${guildId}`) || null;
  }

  if (/INSERT INTO levels \(userId, guildId\)/i.test(cleanSql)) {
    const [userId, guildId] = args;
    const now = Math.floor(Date.now() / 1000);
    const newDoc = {
      userId,
      guildId,
      xp: 0,
      voice_xp: 0,
      level: 0,
      voice_level: 0,
      messages: 0,
      last_message: now,
      reactionsCount: 0
    };
    cache.levels.set(`${userId}_${guildId}`, newDoc);
    safeCollection('levels')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  if (/UPDATE levels SET reactionsCount =/i.test(cleanSql)) {
    const [userId, guildId] = args;
    let doc = cache.levels.get(`${userId}_${guildId}`);
    if (!doc) {
      const now = Math.floor(Date.now() / 1000);
      doc = {
        userId,
        guildId,
        xp: 0,
        voice_xp: 0,
        level: 0,
        voice_level: 0,
        messages: 0,
        last_message: now,
        reactionsCount: 1
      };
    } else {
      doc.reactionsCount = (doc.reactionsCount || 0) + 1;
    }
    cache.levels.set(`${userId}_${guildId}`, doc);
    safeCollection('levels')
      .updateOne({ userId, guildId }, { $set: { reactionsCount: doc.reactionsCount } }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  }

  unhandledSqlStatements.push({ sql, args, timestamp: Date.now() });
  logger.error(
    '[DB Mock] Unhandled SQL statement executed. Add a handler for this query. Statement:',
    sql,
    'Args:',
    args
  );
  if (opType === 'get') return null;
  if (opType === 'all') return [];
  return { changes: 0 };
}

const helpers = {
  connect,

  get db() {
    const obj = {
      prepare(sql) {
        return {
          run(...args) {
            return translateSql('run', sql, args);
          },
          get(...args) {
            return translateSql('get', sql, args);
          },
          all(...args) {
            return translateSql('all', sql, args);
          }
        };
      }
    };
    obj.db = obj;
    return obj;
  },
  prepare(sql) {
    return {
      run(...args) {
        return translateSql('run', sql, args);
      },
      get(...args) {
        return translateSql('get', sql, args);
      },
      all(...args) {
        return translateSql('all', sql, args);
      }
    };
  },

  getGuildSettings(guildId) {
    let row = cache.guild_settings.get(guildId);
    if (!row) {
      row = { guildId, prefix: '#', giveaway_emoji: '🎉', reply_type: 'components_v2', tax_line_image: null };
      cache.guild_settings.set(guildId, row);
      safeCollection('guild_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  getFeelingsSettings(guildId) {
    let row = cache.feelings_settings.get(guildId);
    if (!row) {
      row = { guildId, channelId: null, anonymous: false };
      cache.feelings_settings.set(guildId, row);
      safeCollection('feelings_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  setFeelingsSettings(guildId, channelId, anonymous) {
    const doc = { guildId, channelId, anonymous };
    cache.feelings_settings.set(guildId, doc);
    return safeCollection('feelings_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  getBoostSettings(guildId) {
    let row = cache.boost_settings.get(guildId);
    if (!row) {
      row = { guildId, channelId: null, message: null, useEmbed: false, anchorRoleId: null };
      cache.boost_settings.set(guildId, row);
      safeCollection('boost_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  setBoostSettings(guildId, channelId, message, useEmbed, anchorRoleId) {
    const existing = cache.boost_settings.get(guildId) || {};
    const doc = {
      guildId,
      channelId: channelId !== undefined ? channelId : existing.channelId || null,
      message: message !== undefined ? message : existing.message || null,
      useEmbed: useEmbed !== undefined ? Boolean(useEmbed) : Boolean(existing.useEmbed),
      anchorRoleId: anchorRoleId !== undefined ? anchorRoleId : existing.anchorRoleId || null
    };
    cache.boost_settings.set(guildId, doc);
    return safeCollection('boost_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  getBankSettings(guildId) {
    let row = cache.bank_settings.get(guildId);
    if (!row) {
      row = {
        guildId,
        tradeCooldown: 10800000,
        investCooldown: 10800000,
        dailyCooldown: 172800000,
        salaryCooldown: 86400000,
        gambleCooldown: 14400000,
        diceCooldown: 14400000,
        coinflipCooldown: 7200000
      };
      cache.bank_settings.set(guildId, row);
      safeCollection('bank_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  setBankSettings(guildId, settings) {
    const doc = { guildId, ...settings };
    cache.bank_settings.set(guildId, doc);
    return safeCollection('bank_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  addActiveGame(channelId, guildId, gameType, participants) {
    const doc = { channelId, guildId, gameType, participants, startTime: Date.now() };
    cache.active_games.set(channelId, doc);
    safeCollection('active_games')
      .insertOne(doc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  removeActiveGame(channelId, guildId) {
    cache.active_games.delete(channelId);
    safeCollection('active_games')
      .deleteMany({ channelId, guildId })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  deleteActiveGame(channelId, guildId) {
    return this.removeActiveGame(channelId, guildId);
  },
  getActiveGame(channelId) {
    return cache.active_games.get(channelId);
  },
  getCommandRestrictions(guildId, commandName) {
    return cache.command_restrictions.find((r) => r.guildId === guildId && r.commandName === commandName);
  },
  setCommandRestrictions(guildId, commandName, allowedRoles, allowedChannels) {
    const existingIndex = cache.command_restrictions.findIndex(
      (r) => r.guildId === guildId && r.commandName === commandName
    );
    const doc = { guildId, commandName, allowedRoles, allowedChannels };
    if (existingIndex !== -1) {
      cache.command_restrictions[existingIndex] = doc;
    } else {
      cache.command_restrictions.push(doc);
    }
    safeCollection('command_restrictions')
      .updateOne({ guildId, commandName }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  removeCommandRestrictions(guildId, commandName) {
    cache.command_restrictions = cache.command_restrictions.filter(
      (r) => !(r.guildId === guildId && r.commandName === commandName)
    );
    safeCollection('command_restrictions')
      .deleteMany({ guildId, commandName })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  setGuildSetting(guildId, key, value) {
    const allowed = [
      'prefix',
      'giveaway_emoji',
      'log_channel',
      'setlog_channel',
      'line_image',
      'autoboost_channel',
      'autoboost_message',
      'reply_type',
      'bank_channel',
      'tax_line_image'
    ];
    if (!allowed.includes(key)) throw new Error(`Invalid setting key: ${key}`);

    const doc = cache.guild_settings.get(guildId) || { guildId };
    doc[key] = value;
    cache.guild_settings.set(guildId, doc);
    safeCollection('guild_settings')
      .updateOne({ guildId }, { $set: { [key]: value } }, { upsert: true })
      .catch((err) => logger.error(err));
  },

  addWarning(userId, guildId, reason, moderatorId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const newDoc = { userId, guildId, reason, moderatorId, timestamp };
    cache.warnings.push(newDoc);
    safeCollection('warnings')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  getWarnings(userId, guildId) {
    return cache.warnings
      .filter((w) => w.userId === userId && w.guildId === guildId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },
  clearWarnings(userId, guildId) {
    cache.warnings = cache.warnings.filter((w) => !(w.userId === userId && w.guildId === guildId));
    safeCollection('warnings')
      .deleteMany({ userId, guildId })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  removeWarning(userId, guildId, index) {
    const userWarnings = cache.warnings
      .filter((w) => w.userId === userId && w.guildId === guildId)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (index < 0 || index >= userWarnings.length) return false;
    const targetWarning = userWarnings[index];
    cache.warnings = cache.warnings.filter((w) => w !== targetWarning);
    safeCollection('warnings')
      .deleteOne({ userId, guildId, timestamp: targetWarning.timestamp })
      .catch((err) => logger.error(err));
    return true;
  },

  getLevel(userId, guildId) {
    return cache.levels.get(`${userId}_${guildId}`);
  },
  addXP(userId, guildId, xp) {
    const now = Math.floor(Date.now() / 1000);
    let doc = cache.levels.get(`${userId}_${guildId}`);
    if (!doc) {
      doc = {
        userId,
        guildId,
        xp,
        voice_xp: 0,
        level: 0,
        voice_level: 0,
        messages: 1,
        last_message: now,
        reactionsCount: 0
      };
    } else {
      doc.xp = (doc.xp || 0) + xp;
      doc.messages = (doc.messages || 0) + 1;
      doc.last_message = now;
    }
    cache.levels.set(`${userId}_${guildId}`, doc);
    safeCollection('levels')
      .updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
  },
  addVoiceXP(userId, guildId, xp) {
    let doc = cache.levels.get(`${userId}_${guildId}`);
    if (!doc) {
      doc = {
        userId,
        guildId,
        xp: 0,
        voice_xp: xp,
        level: 0,
        voice_level: 0,
        messages: 0,
        last_message: 0,
        reactionsCount: 0
      };
    } else {
      doc.voice_xp = (doc.voice_xp || 0) + xp;
    }
    cache.levels.set(`${userId}_${guildId}`, doc);
    safeCollection('levels')
      .updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
  },
  setLevel(userId, guildId, level, xp, voice_level, voice_xp) {
    const doc = cache.levels.get(`${userId}_${guildId}`) || {
      userId,
      guildId,
      messages: 0,
      last_message: 0,
      reactionsCount: 0
    };
    doc.level = level;
    doc.xp = xp;
    doc.voice_level = voice_level;
    doc.voice_xp = voice_xp;
    cache.levels.set(`${userId}_${guildId}`, doc);
    safeCollection('levels')
      .updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
  },
  getLeaderboard(guildId, limit = 10) {
    return Array.from(cache.levels.values())
      .filter((u) => u.guildId === guildId)
      .sort((a, b) => (b.xp || 0) + (b.voice_xp || 0) - ((a.xp || 0) + (a.voice_xp || 0)))
      .slice(0, limit);
  },
  getUserRank(userId, guildId) {
    const list = Array.from(cache.levels.values())
      .filter((u) => u.guildId === guildId)
      .sort((a, b) => (b.xp || 0) + (b.voice_xp || 0) - ((a.xp || 0) + (a.voice_xp || 0)));
    const idx = list.findIndex((u) => u.userId === userId);
    return idx !== -1 ? idx + 1 : null;
  },
  getLevelSettings(guildId) {
    let row = cache.level_settings.get(guildId);
    if (!row) {
      row = {
        guildId,
        enabled: 1,
        channel: null,
        xp_min: 15,
        xp_max: 25,
        xp_cooldown: 60,
        role_rewards: [],
        voice_enabled: 1,
        voice_xp_min: 10,
        voice_xp_max: 20
      };
      cache.level_settings.set(guildId, row);
      safeCollection('level_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateLevelSettings(guildId, data) {
    const current = this.getLevelSettings(guildId);
    Object.assign(current, data);
    cache.level_settings.set(guildId, current);
    return safeCollection('level_settings')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  getStreakSettings(guildId) {
    let row = cache.streak_settings.get(guildId);
    if (!row) {
      row = {
        guildId,
        enabled: 1,
        channel_id: null,
        streak_type: 'all',
        bonus_credits: 200,
        role_rewards: [],
        freeze_enabled: 1
      };
      cache.streak_settings.set(guildId, row);
      safeCollection('streak_settings')
        .insertOne(row)
        .catch(() => null);
    }
    if (typeof row.role_rewards === 'string') {
      row.role_rewards = safeJsonParse(row.role_rewards, []);
    }
    return row;
  },

  updateStreakSettings(guildId, data) {
    const current = this.getStreakSettings(guildId);
    Object.assign(current, data);
    cache.streak_settings.set(guildId, current);
    return safeCollection('streak_settings')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  getUserStreak(guildId, userId) {
    const key = `${guildId}_${userId}`;
    let row = cache.user_streaks.get(key);
    if (!row) {
      row = {
        guildId,
        userId,
        current_streak: 0,
        highest_streak: 0,
        last_active: 0,
        freezes: 1
      };
      cache.user_streaks.set(key, row);
    }
    return row;
  },

  updateUserStreak(guildId, userId, data) {
    const key = `${guildId}_${userId}`;
    const current = this.getUserStreak(guildId, userId);
    Object.assign(current, data);
    cache.user_streaks.set(key, current);
    return safeCollection('user_streaks')
      .updateOne({ guildId, userId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  getTopStreaks(guildId, limit = 10) {
    const list = [];
    for (const row of cache.user_streaks.values()) {
      if (row.guildId === guildId && (row.current_streak || 0) > 0) {
        list.push({ ...row });
      }
    }
    return list.sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0)).slice(0, limit);
  },

  getGreetSettings(guildId) {
    let row = cache.greet_settings.get(guildId);
    if (!row) {
      row = {
        guildId,
        channel: null,
        message: 'Welcome {user} to {server}!',
        dm_message: null,
        delete_after: 0,
        enabled: 0,
        image_url: null,
        avatar_x: 100,
        avatar_y: 100,
        avatar_size: 150,
        username_x: 100,
        username_y: 300,
        username_color: '#ffffff',
        username_size: 40,
        image_scale_mode: 'fit',
        avatar_x_mm: 0,
        avatar_y_mm: 0,
        avatar_size_mm: 0,
        username_x_mm: 0,
        username_y_mm: 0,
        username_size_mm: 0
      };
      cache.greet_settings.set(guildId, row);
      safeCollection('greet_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateGreetSettings(guildId, settings) {
    cache.greet_settings.set(guildId, settings);
    return safeCollection('greet_settings')
      .updateOne({ guildId }, { $set: stripId(settings) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  setGreetSettings(settingsOrGuildId, maybeSettings) {
    let guildId;
    let settings;
    if (typeof settingsOrGuildId === 'string') {
      guildId = settingsOrGuildId;
      settings = maybeSettings || {};
    } else {
      settings = settingsOrGuildId || {};
      guildId = settings.guildId;
    }
    return this.updateGreetSettings(guildId, settings);
  },
  getAutomation(guildId, channelId) {
    return cache.automation.filter((a) => a.guildId === guildId && a.channelId === channelId);
  },
  getAllAutomation(guildId) {
    return cache.automation.filter((a) => a.guildId === guildId);
  },
  addAutomation(guildId, channelId, type, value) {
    cache.automation = cache.automation.filter(
      (a) => !(a.guildId === guildId && a.channelId === channelId && a.type === type)
    );
    safeCollection('automation')
      .deleteMany({ guildId, channelId, type })
      .catch(() => null);

    const newDoc = { guildId, channelId, type, value };
    cache.automation.push(newDoc);
    safeCollection('automation')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  removeAutomation(guildId, channelId, type) {
    cache.automation = cache.automation.filter(
      (a) => !(a.guildId === guildId && a.channelId === channelId && a.type === type)
    );
    safeCollection('automation')
      .deleteMany({ guildId, channelId, type })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },

  createGiveaway(messageId, channelId, guildId, prize, winners, host, endTime, emoji) {
    const doc = { messageId, channelId, guildId, prize, winners, host, endTime, emoji, ended: 0, paused: 0 };
    cache.giveaways.set(messageId, doc);
    safeCollection('giveaways')
      .insertOne(doc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  getGiveaway(messageId) {
    return cache.giveaways.get(messageId);
  },
  getActiveGiveaways(guildId) {
    return Array.from(cache.giveaways.values()).filter((g) => g.guildId === guildId && g.ended === 0);
  },
  getAllActiveGiveaways() {
    return Array.from(cache.giveaways.values()).filter((g) => g.ended === 0 && g.paused === 0);
  },
  endGiveaway(messageId) {
    const doc = cache.giveaways.get(messageId);
    if (doc) {
      doc.ended = 1;
      cache.giveaways.set(messageId, doc);
      safeCollection('giveaways')
        .updateOne({ messageId }, { $set: { ended: 1 } })
        .catch((err) => logger.error(err));
    }
    return { changes: 1 };
  },
  updateGiveaway(messageId, field, value) {
    const allowed = ['prize', 'winners', 'emoji', 'endTime', 'ended', 'paused'];
    if (!allowed.includes(field)) throw new Error(`Invalid giveaway field: ${field}`);

    const doc = cache.giveaways.get(messageId);
    if (doc) {
      doc[field] = value;
      cache.giveaways.set(messageId, doc);
      safeCollection('giveaways')
        .updateOne({ messageId }, { $set: { [field]: value } })
        .catch((err) => logger.error(err));
    }
    return { changes: 1 };
  },

  getProtection(guildId) {
    let row = cache.protection_settings.get(guildId);
    if (!row) {
      row = {
        guildId,
        enabled: 0,
        antilink: 0,
        antispam: 0,
        antiraid: 0,
        bypass_role: null,
        ban_limit: 3,
        kick_limit: 3,
        channel_limit: 3,
        role_limit: 3,
        webhook_limit: 3,
        action: 'ban',
        antilink_channels: []
      };
      cache.protection_settings.set(guildId, row);
      safeCollection('protection_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateProtection(guildId, data) {
    const current = this.getProtection(guildId);
    const fields = [
      'enabled',
      'antilink',
      'antispam',
      'antiraid',
      'bypass_role',
      'ban_limit',
      'kick_limit',
      'channel_limit',
      'role_limit',
      'webhook_limit',
      'action',
      'antilink_channels'
    ];
    for (const key of fields) {
      if (data[key] !== undefined) current[key] = data[key];
    }
    cache.protection_settings.set(guildId, current);
    return safeCollection('protection_settings')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  getWhitelist(guildId) {
    return cache.whitelist.filter((w) => w.guildId === guildId);
  },
  addWhitelist(guildId, targetId, type) {
    const exists = cache.whitelist.some((w) => w.guildId === guildId && w.targetId === targetId && w.type === type);
    if (!exists) {
      const newDoc = { guildId, targetId, type };
      cache.whitelist.push(newDoc);
      safeCollection('whitelist')
        .insertOne(newDoc)
        .catch(() => null);
    }
    return { changes: 1 };
  },
  removeWhitelist(guildId, targetId) {
    cache.whitelist = cache.whitelist.filter((w) => !(w.guildId === guildId && w.targetId === targetId));
    safeCollection('whitelist')
      .deleteMany({ guildId, targetId })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  addBlacklist(guildId, targetId, type) {
    const exists = cache.blacklist.some((b) => b.guildId === guildId && b.targetId === targetId && b.type === type);
    if (!exists) {
      const newDoc = { guildId, targetId, type };
      cache.blacklist.push(newDoc);
      safeCollection('blacklist')
        .insertOne(newDoc)
        .catch(() => null);
    }
    return { changes: 1 };
  },
  removeBlacklist(guildId, targetId) {
    cache.blacklist = cache.blacklist.filter((b) => !(b.guildId === guildId && b.targetId === targetId));
    safeCollection('blacklist')
      .deleteMany({ guildId, targetId })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  isWhitelisted(guildId, targetId) {
    return cache.whitelist.some((w) => w.guildId === guildId && w.targetId === targetId);
  },

  getInvites(userId, guildId) {
    let row = cache.invites.get(`${userId}_${guildId}`);
    if (!row) {
      row = { userId, guildId, total: 0, fake: 0, left: 0, bonus: 0 };
      cache.invites.set(`${userId}_${guildId}`, row);
      safeCollection('invites')
        .insertOne(row)
        .catch(() => null);
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
    safeCollection('invites')
      .updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
  },
  resetInvites(userId, guildId) {
    const doc = cache.invites.get(`${userId}_${guildId}`);
    if (doc) {
      doc.total = 0;
      doc.fake = 0;
      doc.left = 0;
      doc.bonus = 0;
      cache.invites.set(`${userId}_${guildId}`, doc);
      safeCollection('invites')
        .updateOne({ userId, guildId }, { $set: { total: 0, fake: 0, left: 0, bonus: 0 } })
        .catch((err) => logger.error(err));
    }
  },
  resetAllInvites(guildId) {
    for (const val of cache.invites.values()) {
      if (val.guildId === guildId) {
        val.total = 0;
        val.fake = 0;
        val.left = 0;
        val.bonus = 0;
      }
    }
    safeCollection('invites')
      .updateMany({ guildId }, { $set: { total: 0, fake: 0, left: 0, bonus: 0 } })
      .catch((err) => logger.error(err));
  },
  getInviteRanks(guildId) {
    return cache.invite_ranks.filter((r) => r.guildId === guildId).sort((a, b) => a.count - b.count);
  },
  addInviteRank(guildId, count, roleId) {
    cache.invite_ranks = cache.invite_ranks.filter((r) => !(r.guildId === guildId && r.count === count));
    safeCollection('invite_ranks')
      .deleteMany({ guildId, count })
      .catch(() => null);

    const newDoc = { guildId, count, roleId };
    cache.invite_ranks.push(newDoc);
    safeCollection('invite_ranks')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  getInviteLogs(guildId) {
    return cache.invite_logs.get(guildId);
  },

  getTicketSettings(guildId) {
    let row = cache.ticket_settings.get(guildId);
    if (!row) {
      row = {
        guildId,
        category_id: null,
        log_channel: null,
        staff_role: null,
        panel_channel: null,
        feedbacks_channel: null,
        owners_role: null,
        support_message: 'Click the button below to open a ticket!',
        ticket_message: 'Thank you for opening a ticket! Support will be with you shortly.',
        panel_data: {}
      };
      cache.ticket_settings.set(guildId, row);
      safeCollection('ticket_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateTicketSettings(guildId, data) {
    const current = this.getTicketSettings(guildId);
    if (data.category_id !== undefined) current.category_id = data.category_id;
    if (data.log_channel !== undefined) current.log_channel = data.log_channel;
    if (data.feedbacks_channel !== undefined) current.feedbacks_channel = data.feedbacks_channel;
    if (data.owners_role !== undefined) current.owners_role = data.owners_role;
    if (data.staff_role !== undefined) current.staff_role = data.staff_role;
    if (data.panel_channel !== undefined) current.panel_channel = data.panel_channel;
    if (data.support_message !== undefined) current.support_message = data.support_message;
    if (data.ticket_message !== undefined) current.ticket_message = data.ticket_message;
    if (data.panel_data !== undefined) current.panel_data = safeJsonParse(data.panel_data, {});

    cache.ticket_settings.set(guildId, current);
    return safeCollection('ticket_settings')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  getTicketCategories(guildId) {
    return cache.ticket_categories ? cache.ticket_categories.filter((c) => c.guildId === guildId) : [];
  },
  addTicketCategory(guildId, category) {
    if (!cache.ticket_categories) cache.ticket_categories = [];
    const newDoc = { guildId, ...category };
    cache.ticket_categories.push(newDoc);
    safeCollection('ticket_categories')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  removeTicketCategory(guildId, name) {
    if (cache.ticket_categories) {
      cache.ticket_categories = cache.ticket_categories.filter((c) => !(c.guildId === guildId && c.name === name));
    }
    safeCollection('ticket_categories')
      .deleteMany({ guildId, name })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  createTicket(guildId, userId, channelId, category, extra = {}) {
    const timestamp = Math.floor(Date.now() / 1000);
    const doc = {
      guildId,
      userId,
      channelId,
      status: 'open',
      category: category || 'عام',
      department: category || 'عام',
      subject: extra.subject || 'بدون موضوع',
      description: extra.description || '',
      priority: extra.priority || 'medium',
      departmentRole: extra.departmentRole || null,
      claimedBy: null,
      claimedAt: null,
      created_at: timestamp,
      lastMessageAt: Date.now(),
      firstResponseAt: null,
      firstResponseTimeSeconds: null,
      closedAt: null,
      closedBy: null,
      resolutionTimeSeconds: null,
      staleWarned: false
    };
    cache.tickets.push(doc);
    safeCollection('tickets')
      .insertOne(doc)
      .catch((err) => logger.error(err));
    return { changes: 1, ticket: doc };
  },
  getTicketByChannel(channelId) {
    return cache.tickets.find((t) => t.channelId === channelId);
  },
  updateTicketStatus(channelId, status) {
    const t = cache.tickets.find((tk) => tk.channelId === channelId);
    if (t) {
      t.status = status;
      safeCollection('tickets')
        .updateOne({ channelId }, { $set: { status } })
        .catch((err) => logger.error(err));
    }
    return { changes: 1 };
  },
  updateTicketActivity(channelId, authorId, isStaff) {
    const ticket = cache.tickets.find((t) => t.channelId === channelId);
    if (!ticket) return null;
    ticket.lastMessageAt = Date.now();
    const updateFields = { lastMessageAt: ticket.lastMessageAt };

    if (isStaff && !ticket.firstResponseAt && authorId !== ticket.userId) {
      ticket.firstResponseAt = Date.now();
      ticket.firstResponseTimeSeconds = Math.floor((ticket.firstResponseAt - ticket.created_at * 1000) / 1000);
      updateFields.firstResponseAt = ticket.firstResponseAt;
      updateFields.firstResponseTimeSeconds = ticket.firstResponseTimeSeconds;
    }

    safeCollection('tickets')
      .updateOne({ channelId }, { $set: updateFields })
      .catch(() => null);
    return ticket;
  },
  updateTicketPriority(channelId, priority) {
    const ticket = cache.tickets.find((t) => t.channelId === channelId);
    if (ticket) {
      ticket.priority = priority;
      safeCollection('tickets')
        .updateOne({ channelId }, { $set: { priority } })
        .catch(() => null);
    }
    return ticket;
  },
  updateTicketDepartment(channelId, category, departmentRole) {
    const ticket = cache.tickets.find((t) => t.channelId === channelId);
    if (ticket) {
      ticket.category = category;
      ticket.department = category;
      ticket.departmentRole = departmentRole;
      safeCollection('tickets')
        .updateOne({ channelId }, { $set: { category, department: category, departmentRole } })
        .catch(() => null);
    }
    return ticket;
  },
  claimTicket(channelId, userId) {
    const ticket = cache.tickets.find((t) => t.channelId === channelId);
    if (!ticket) return false;
    ticket.claimedBy = userId;
    ticket.claimedAt = Date.now();
    safeCollection('tickets')
      .updateOne({ channelId }, { $set: { claimedBy: userId, claimedAt: ticket.claimedAt } })
      .catch((err) => logger.error(err));
    return true;
  },
  unclaimTicket(channelId) {
    const ticket = cache.tickets.find((t) => t.channelId === channelId);
    if (!ticket) return false;
    ticket.claimedBy = null;
    ticket.claimedAt = null;
    safeCollection('tickets')
      .updateOne({ channelId }, { $set: { claimedBy: null, claimedAt: null } })
      .catch((err) => logger.error(err));
    return true;
  },
  closeTicket(channelId, closedBy, resolutionReason = '') {
    const ticket = cache.tickets.find((t) => t.channelId === channelId);
    if (!ticket) return null;
    ticket.status = 'closed';
    ticket.closedBy = closedBy;
    ticket.closedAt = Date.now();
    ticket.resolutionReason = resolutionReason;
    ticket.resolutionTimeSeconds = Math.floor((ticket.closedAt - ticket.created_at * 1000) / 1000);
    safeCollection('tickets')
      .updateOne(
        { channelId },
        {
          $set: {
            status: 'closed',
            closedBy,
            closedAt: ticket.closedAt,
            resolutionReason,
            resolutionTimeSeconds: ticket.resolutionTimeSeconds
          }
        }
      )
      .catch(() => null);
    return ticket;
  },
  markTicketStaleWarned(channelId) {
    const ticket = cache.tickets.find((t) => t.channelId === channelId);
    if (ticket) {
      ticket.staleWarned = true;
      safeCollection('tickets')
        .updateOne({ channelId }, { $set: { staleWarned: true } })
        .catch(() => null);
    }
    return ticket;
  },
  getOpenTickets(guildId) {
    return cache.tickets.filter((t) => (!guildId || t.guildId === guildId) && t.status === 'open');
  },
  addTicketRating(guildId, channelId, userId, staffId, rating, comment = '') {
    const doc = {
      guildId,
      channelId,
      userId,
      staffId: staffId || null,
      rating: Number(rating),
      comment: comment || '',
      createdAt: Date.now()
    };
    cache.ticket_ratings.push(doc);
    if (cache.ticket_ratings.length > 5000) {
      cache.ticket_ratings = cache.ticket_ratings.slice(-5000);
    }
    safeCollection('ticket_ratings')
      .insertOne(doc)
      .catch((err) => logger.error('[DB ticket_ratings]', err));
    return doc;
  },
  getTicketRatings(guildId, limit = 50) {
    return cache.ticket_ratings
      .filter((r) => !guildId || r.guildId === guildId)
      .slice(-limit)
      .reverse();
  },
  addCannedResponse(guildId, shortcut, content, addedBy = null) {
    shortcut = shortcut.toLowerCase().trim();
    const existingIndex = cache.canned_responses.findIndex(
      (c) => c.guildId === guildId && (c.shortcut === shortcut || c.name === shortcut)
    );
    const doc = { guildId, shortcut, name: shortcut, content, addedBy, updatedAt: Date.now() };
    if (existingIndex !== -1) {
      cache.canned_responses[existingIndex] = doc;
    } else {
      cache.canned_responses.push(doc);
    }
    safeCollection('canned_responses')
      .updateOne({ guildId, shortcut }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error('[DB canned_responses]', err));
    return doc;
  },
  removeCannedResponse(guildId, shortcut) {
    shortcut = shortcut.toLowerCase().trim();
    const before = cache.canned_responses.length;
    cache.canned_responses = cache.canned_responses.filter(
      (c) => !(c.guildId === guildId && (c.shortcut === shortcut || c.name === shortcut))
    );
    safeCollection('canned_responses')
      .deleteOne({ guildId, shortcut })
      .catch((err) => logger.error('[DB canned_responses remove]', err));
    return cache.canned_responses.length < before;
  },
  getCannedResponses(guildId) {
    return cache.canned_responses.filter((c) => c.guildId === guildId);
  },
  getCannedResponse(guildId, shortcut) {
    const key = shortcut.toLowerCase().trim();
    return cache.canned_responses.find((c) => c.guildId === guildId && (c.shortcut === key || c.name === key));
  },
  saveWebTranscript(arg1, arg2, arg3, arg4, arg5) {
    let guildId, channelId, userId, channelName, htmlContent;
    if (typeof arg5 !== 'undefined') {
      guildId = arg1;
      channelId = arg2;
      userId = arg3;
      channelName = arg4;
      htmlContent = arg5;
    } else if (typeof arg3 === 'undefined') {
      channelId = arg1;
      htmlContent = arg2;
      guildId = null;
      userId = null;
      channelName = `ticket-${channelId}`;
    } else {
      channelId = arg1;
      guildId = arg2;
      userId = arg3;
      htmlContent = arg4;
      channelName = '';
    }
    const doc = {
      guildId,
      channelId,
      userId,
      channelName: channelName || `ticket-${channelId}`,
      html: htmlContent,
      savedAt: Date.now()
    };
    cache.ticket_transcripts.set(channelId, doc);
    if (cache.ticket_transcripts.size > 100) {
      const firstKey = cache.ticket_transcripts.keys().next().value;
      if (firstKey) cache.ticket_transcripts.delete(firstKey);
    }
    safeCollection('ticket_transcripts')
      .updateOne({ channelId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error('[DB ticket_transcripts save]', err));
    return doc;
  },
  async getWebTranscript(channelId) {
    let item = cache.ticket_transcripts.get(channelId);
    if (!item && mongoDb) {
      item = await safeCollection('ticket_transcripts')
        .findOne({ channelId })
        .catch(() => null);
      if (item) cache.ticket_transcripts.set(channelId, item);
    }
    return item ? item.html || item : null;
  },
  getTicketAnalytics(guildId) {
    const guildTickets = cache.tickets.filter((t) => t.guildId === guildId);
    const openCount = guildTickets.filter((t) => t.status === 'open').length;
    const closedTickets = guildTickets.filter((t) => t.status === 'closed');
    const closedCount = closedTickets.length;

    // Response times
    const respondedTickets = guildTickets.filter((t) => t.firstResponseTimeSeconds && t.firstResponseTimeSeconds > 0);
    const avgFirstResponseSeconds =
      respondedTickets.length > 0
        ? Math.round(respondedTickets.reduce((acc, t) => acc + t.firstResponseTimeSeconds, 0) / respondedTickets.length)
        : 0;

    // Resolution times
    const resolvedTickets = closedTickets.filter((t) => t.resolutionTimeSeconds && t.resolutionTimeSeconds > 0);
    const avgResolutionSeconds =
      resolvedTickets.length > 0
        ? Math.round(resolvedTickets.reduce((acc, t) => acc + t.resolutionTimeSeconds, 0) / resolvedTickets.length)
        : 0;

    // Ratings
    const ratings = cache.ticket_ratings.filter((r) => r.guildId === guildId);
    const avgRating =
      ratings.length > 0 ? (ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(1) : '5.0';

    // Staff breakdown
    const staffMap = {};
    for (const t of guildTickets) {
      if (t.claimedBy) {
        if (!staffMap[t.claimedBy])
          staffMap[t.claimedBy] = { staffId: t.claimedBy, claimed: 0, closed: 0, ratings: [] };
        staffMap[t.claimedBy].claimed++;
        if (t.status === 'closed') staffMap[t.claimedBy].closed++;
      }
    }
    for (const r of ratings) {
      if (r.staffId && staffMap[r.staffId]) {
        staffMap[r.staffId].ratings.push(r.rating);
      }
    }
    const staffLeaderboard = Object.values(staffMap)
      .map((s) => ({
        staffId: s.staffId,
        claimed: s.claimed,
        closed: s.closed,
        avgScore: s.ratings.length > 0 ? (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(1) : '-'
      }))
      .sort((a, b) => b.claimed - a.claimed);

    return {
      total: guildTickets.length,
      totalTickets: guildTickets.length,
      open: openCount,
      openTickets: openCount,
      closed: closedCount,
      closedTickets: closedCount,
      avgFirstResponseSeconds,
      avgFirstResponseMinutes: Math.round(avgFirstResponseSeconds / 60),
      avgResolutionSeconds,
      avgResolutionMinutes: Math.round(avgResolutionSeconds / 60),
      averageRating: Number(avgRating) || 5.0,
      totalRatings: ratings.length,
      staffLeaderboard
    };
  },

  // ── Sticky Roles System ──────────────────────────────
  getStickyRoleSettings(guildId) {
    let doc = cache.sticky_role_settings.get(guildId);
    if (!doc) {
      doc = { guildId, enabled: true, ignoredRoles: [] };
      cache.sticky_role_settings.set(guildId, doc);
    }
    return doc;
  },
  setStickyRoleSettings(guildId, settings) {
    const doc = { ...helpers.getStickyRoleSettings(guildId), ...settings };
    cache.sticky_role_settings.set(guildId, doc);
    safeCollection('sticky_role_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error('[DB sticky_role_settings]', err));
    return doc;
  },
  saveStickyRoles(guildId, userId, roleIds) {
    const key = `${guildId}_${userId}`;
    const doc = {
      guildId,
      userId,
      roleIds: Array.from(new Set(roleIds)),
      savedAt: Date.now()
    };
    cache.sticky_roles.set(key, doc);
    safeCollection('sticky_roles')
      .updateOne({ guildId, userId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error('[DB sticky_roles save]', err));
    return doc;
  },
  getStickyRoles(guildId, userId) {
    return cache.sticky_roles.get(`${guildId}_${userId}`);
  },
  deleteStickyRoles(guildId, userId) {
    const key = `${guildId}_${userId}`;
    cache.sticky_roles.delete(key);
    safeCollection('sticky_roles')
      .deleteOne({ guildId, userId })
      .catch((err) => logger.error('[DB sticky_roles delete]', err));
  },
  getAllStickyRoles(guildId) {
    const out = [];
    for (const doc of cache.sticky_roles.values()) {
      if (doc.guildId === guildId) out.push(doc);
    }
    return out;
  },

  addTicketBlacklist(guildId, userId) {
    const row = {
      guildId,
      userId,
      createdAt: Date.now()
    };

    cache.ticket_blacklist ??= [];
    cache.ticket_blacklist.push(row);

    return safeCollection('ticket_blacklist').insertOne(row);
  },

  removeTicketBlacklist(guildId, userId) {
    cache.ticket_blacklist = (cache.ticket_blacklist || []).filter(
      (x) => !(x.guildId === guildId && x.userId === userId)
    );

    return safeCollection('ticket_blacklist').deleteOne({
      guildId,
      userId
    });
  },

  isTicketBlacklisted(guildId, userId) {
    return (cache.ticket_blacklist || []).some((x) => x.guildId === guildId && x.userId === userId);
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

    return safeCollection('ticket_warnings').insertOne(row);
  },

  getTicketWarnings(guildId, userId) {
    return (cache.ticket_warnings || []).filter((x) => x.guildId === guildId && x.userId === userId);
  },

  getAutoReplies(guildId) {
    return cache.auto_reply.filter((a) => a.guildId === guildId);
  },
  addAutoReply(guildId, trigger, response, deleteTrigger = 0, mode = 'reply') {
    const doc = { guildId, trigger, response, deleteTrigger: Number(deleteTrigger), mode };
    cache.auto_reply.push(doc);
    safeCollection('auto_reply')
      .insertOne(doc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  removeAutoReply(guildId, trigger) {
    cache.auto_reply = cache.auto_reply.filter((a) => !(a.guildId === guildId && a.trigger === trigger));
    safeCollection('auto_reply')
      .deleteMany({ guildId, trigger })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },

  setSnipe(channelId, content, authorId, authorTag, authorAvatar) {
    const now = Math.floor(Date.now() / 1000);
    const doc = { channelId, content, authorId, authorTag, authorAvatar, timestamp: now };
    cache.snipe.set(channelId, doc);
    safeCollection('snipe')
      .updateOne({ channelId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
  },
  getSnipe(channelId) {
    return cache.snipe.get(channelId);
  },

  getLogSettings(guildId) {
    let row = cache.log_settings.get(guildId);
    if (!row) {
      row = {
        guildId,
        ban_channel: null,
        unban_channel: null,
        kick_channel: null,
        timeout_channel: null,
        warn_channel: null,
        message_delete_channel: null,
        message_edit_channel: null,
        member_join_channel: null,
        member_leave_channel: null,
        channel_create_channel: null,
        channel_delete_channel: null,
        role_create_channel: null,
        role_delete_channel: null,
        nick_change_channel: null
      };
      cache.log_settings.set(guildId, row);
      safeCollection('log_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  setLogChannel(guildId, channelId) {
    this.setGuildSetting(guildId, 'log_channel', channelId);
    this.getLogSettings(guildId);
  },

  getAliases(guildId) {
    return cache.aliases.filter((a) => a.guildId === guildId);
  },
  addAlias(guildId, shortcut, command) {
    const doc = { guildId, shortcut, command };
    cache.aliases.push(doc);
    safeCollection('aliases')
      .insertOne(doc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  removeAlias(guildId, shortcut) {
    cache.aliases = cache.aliases.filter((a) => !(a.guildId === guildId && a.shortcut === shortcut));
    safeCollection('aliases')
      .deleteMany({ guildId, shortcut })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },

  getFormsSettings(guildId) {
    let row = cache.forms_settings.get(guildId);
    if (!row) {
      row = { guildId, log_channel: null, panel_data: {}, questions: [] };
      cache.forms_settings.set(guildId, row);
      safeCollection('forms_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateFormsSettings(guildId, data) {
    const current = this.getFormsSettings(guildId);
    if (data.log_channel !== undefined) current.log_channel = data.log_channel;
    if (data.panel_data !== undefined) current.panel_data = safeJsonParse(data.panel_data, {});
    if (data.questions !== undefined) current.questions = safeJsonParse(data.questions, []);

    cache.forms_settings.set(guildId, current);
    return safeCollection('forms_settings')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  getReactionRoles(guildId) {
    let row = cache.reaction_roles.get(guildId);
    if (!row) {
      row = { guildId, panel_data: {}, roles_data: [] };
      cache.reaction_roles.set(guildId, row);
      safeCollection('reaction_roles')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateReactionRoles(guildId, data) {
    const current = this.getReactionRoles(guildId);
    if (data.panel_data !== undefined) current.panel_data = safeJsonParse(data.panel_data, {});
    if (data.roles_data !== undefined) current.roles_data = safeJsonParse(data.roles_data, []);

    cache.reaction_roles.set(guildId, current);
    return safeCollection('reaction_roles')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  addReactRole(messageId, guildId, emoji, roleId) {
    if (!cache.reactroles) cache.reactroles = [];
    cache.reactroles = cache.reactroles.filter((r) => !(r.messageId === messageId && r.emoji === emoji));
    const newDoc = { messageId, guildId, emoji, roleId };
    cache.reactroles.push(newDoc);
    safeCollection('reactroles')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  getReactRole(messageId, emoji) {
    return (cache.reactroles || []).find((r) => r.messageId === messageId && r.emoji === emoji);
  },
  incrementReactionsCount(userId, guildId) {
    const levelData = this.getLevel(userId, guildId);
    if (levelData) {
      levelData.reactionsCount = (levelData.reactionsCount || 0) + 1;
      cache.levels.set(`${userId}_${guildId}`, levelData);
      safeCollection('levels')
        .updateOne({ userId, guildId }, { $set: { reactionsCount: levelData.reactionsCount } })
        .catch((err) => logger.error(err));
    }
  },

  getCaptchaSettings(guildId) {
    let row = cache.captcha_settings.get(guildId);
    if (!row) {
      row = { guildId, enabled: 0, unverified_role: null, verified_role: null, panel_channel: null, panel_data: {} };
      cache.captcha_settings.set(guildId, row);
      safeCollection('captcha_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateCaptchaSettings(guildId, data) {
    const current = this.getCaptchaSettings(guildId);
    if (data.enabled !== undefined) current.enabled = data.enabled;
    if (data.unverified_role !== undefined) current.unverified_role = data.unverified_role;
    if (data.verified_role !== undefined) current.verified_role = data.verified_role;
    if (data.panel_channel !== undefined) current.panel_channel = data.panel_channel;
    if (data.panel_data !== undefined) current.panel_data = safeJsonParse(data.panel_data, {});

    cache.captcha_settings.set(guildId, current);
    return safeCollection('captcha_settings')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  getTempVoiceSettings(guildId) {
    let row = cache.tempvoice_settings.get(guildId);
    if (!row) {
      row = { guildId, master_channel: null, category_id: null, panel_channel: null };
      cache.tempvoice_settings.set(guildId, row);
      safeCollection('tempvoice_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateTempVoiceSettings(guildId, master_channel, category_id) {
    const doc = cache.tempvoice_settings.get(guildId) || { guildId };
    doc.master_channel = master_channel;
    doc.category_id = category_id;
    cache.tempvoice_settings.set(guildId, doc);
    return safeCollection('tempvoice_settings')
      .updateOne({ guildId }, { $set: { master_channel, category_id } }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  updateTempVoicePanel(guildId, panel_channel) {
    const doc = cache.tempvoice_settings.get(guildId) || { guildId };
    doc.panel_channel = panel_channel;
    cache.tempvoice_settings.set(guildId, doc);
    return safeCollection('tempvoice_settings')
      .updateOne({ guildId }, { $set: { panel_channel } }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  getJailSettings(guildId) {
    let row = cache.jail_settings.get(guildId);
    if (!row) {
      row = { guildId, jailRoleId: null, jailChannelId: null, staffVoiceId: null };
      cache.jail_settings.set(guildId, row);
      safeCollection('jail_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  setJailSettings(guildId, roleId, channelId, staffVoiceId, staffRoleId) {
    const doc = { guildId, jailRoleId: roleId, jailChannelId: channelId, staffVoiceId, staffRoleId };
    cache.jail_settings.set(guildId, doc);
    return safeCollection('jail_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  getJailedUser(userId, guildId) {
    return cache.jailed_users.get(`${userId}_${guildId}`);
  },
  addJailedUser(userId, guildId, oldRoles) {
    const now = Math.floor(Date.now() / 1000);
    const doc = { userId, guildId, oldRoles, jailedAt: now };
    cache.jailed_users.set(`${userId}_${guildId}`, doc);
    return safeCollection('jailed_users')
      .updateOne({ userId, guildId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  removeJailedUser(userId, guildId) {
    cache.jailed_users.delete(`${userId}_${guildId}`);
    return safeCollection('jailed_users')
      .deleteOne({ userId, guildId })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  addTempVoiceChannel(channelId, ownerId, guildId) {
    const doc = { channelId, ownerId, guildId };
    cache.tempvoice_channels.set(channelId, doc);
    return safeCollection('tempvoice_channels')
      .insertOne(doc)
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  getTempVoiceChannel(channelId) {
    return cache.tempvoice_channels.get(channelId);
  },
  removeTempVoiceChannel(channelId) {
    cache.tempvoice_channels.delete(channelId);
    return safeCollection('tempvoice_channels')
      .deleteOne({ channelId })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  getTempVoiceChannelsByGuild(guildId) {
    return Array.from(cache.tempvoice_channels.values()).filter((c) => c.guildId === guildId);
  },

  getBotSettings() {
    let row = cache.bot_settings.get(1);
    if (!row) {
      row = { id: 1, status: 'online', activity_type: 'PLAYING', activity_name: 'E-246 System' };
      cache.bot_settings.set(1, row);
      safeCollection('bot_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },
  updateBotSettings(status, activity_type, activity_name, emoji_color, broadcast_tokens) {
    const doc = cache.bot_settings.get(1) || { id: 1 };
    doc.status = status;
    doc.activity_type = activity_type;
    doc.activity_name = activity_name;
    doc.emoji_color = emoji_color;
    doc.broadcast_tokens = broadcast_tokens;
    cache.bot_settings.set(1, doc);
    return safeCollection('bot_settings')
      .updateOne(
        { id: 1 },
        { $set: { status, activity_type, activity_name, emoji_color, broadcast_tokens } },
        { upsert: true }
      )
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  getTempVoiceUserSettings(userId) {
    return cache.tempvoice_user_settings.get(userId);
  },
  saveTempVoiceUserSettings(userId, name, limit) {
    const doc = { userId, preferredName: name, preferredLimit: limit };
    cache.tempvoice_user_settings.set(userId, doc);
    return safeCollection('tempvoice_user_settings')
      .updateOne({ userId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  addTempVoiceBan(channelId, targetId) {
    const doc = { channelId, targetId };
    cache.tempvoice_bans.set(`${channelId}_${targetId}`, doc);
    return safeCollection('tempvoice_bans')
      .updateOne({ channelId, targetId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  removeTempVoiceBan(channelId, targetId) {
    cache.tempvoice_bans.delete(`${channelId}_${targetId}`);
    return safeCollection('tempvoice_bans')
      .deleteOne({ channelId, targetId })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  isTempVoiceBanned(channelId, targetId) {
    return cache.tempvoice_bans.has(`${channelId}_${targetId}`);
  },
  getTempVoiceBans(channelId) {
    return Array.from(cache.tempvoice_bans.values()).filter((b) => b.channelId === channelId);
  },

  addTempVoiceTrusted(channelId, userId) {
    const doc = { channelId, userId };
    cache.tempvoice_trusted.set(`${channelId}_${userId}`, doc);
    return safeCollection('tempvoice_trusted')
      .updateOne({ channelId, userId }, { $set: stripId(doc) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  removeTempVoiceTrusted(channelId, userId) {
    cache.tempvoice_trusted.delete(`${channelId}_${userId}`);
    return safeCollection('tempvoice_trusted')
      .deleteOne({ channelId, userId })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },
  isTempVoiceTrusted(channelId, userId) {
    return cache.tempvoice_trusted.has(`${channelId}_${userId}`);
  },
  getTempVoiceTrustedUsers(channelId) {
    return Array.from(cache.tempvoice_trusted.values()).filter((t) => t.channelId === channelId);
  },

  incrementDailyJoins(guildId) {
    const today = new Date().toISOString().split('T')[0];
    let doc = cache.stats_daily_members.get(`${guildId}_${today}`);
    if (!doc) {
      doc = { guildId, date: today, joins: 1, leaves: 0 };
    } else {
      doc.joins = (doc.joins || 0) + 1;
    }
    cache.stats_daily_members.set(`${guildId}_${today}`, doc);
    safeCollection('stats_daily_members')
      .updateOne({ guildId, date: today }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  incrementDailyLeaves(guildId) {
    const today = new Date().toISOString().split('T')[0];
    let doc = cache.stats_daily_members.get(`${guildId}_${today}`);
    if (!doc) {
      doc = { guildId, date: today, joins: 0, leaves: 1 };
    } else {
      doc.leaves = (doc.leaves || 0) + 1;
    }
    cache.stats_daily_members.set(`${guildId}_${today}`, doc);
    safeCollection('stats_daily_members')
      .updateOne({ guildId, date: today }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  incrementHourlyMessages(guildId) {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    let doc = cache.stats_hourly_messages.get(`${guildId}_${today}_${hour}`);
    if (!doc) {
      doc = { guildId, date: today, hour, message_count: 1 };
    } else {
      doc.message_count = (doc.message_count || 0) + 1;
    }
    cache.stats_hourly_messages.set(`${guildId}_${today}_${hour}`, doc);
    safeCollection('stats_hourly_messages')
      .updateOne({ guildId, date: today, hour }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  addDailyVoiceSeconds(guildId, seconds) {
    const today = new Date().toISOString().split('T')[0];
    let doc = cache.stats_daily_voice.get(`${guildId}_${today}`);
    if (!doc) {
      doc = { guildId, date: today, seconds };
    } else {
      doc.seconds = (doc.seconds || 0) + seconds;
    }
    cache.stats_daily_voice.set(`${guildId}_${today}`, doc);
    safeCollection('stats_daily_voice')
      .updateOne({ guildId, date: today }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },

  getDailyMembersStats(guildId, daysCount = 7) {
    return Array.from(cache.stats_daily_members.values())
      .filter((s) => s.guildId === guildId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, daysCount)
      .reverse();
  },
  getHourlyMessagesStats(guildId) {
    const statsMap = {};
    for (const val of cache.stats_hourly_messages.values()) {
      if (val.guildId === guildId) {
        statsMap[val.hour] = (statsMap[val.hour] || 0) + (val.message_count || 0);
      }
    }
    return Object.keys(statsMap)
      .map((h) => ({ hour: parseInt(h), count: statsMap[h] }))
      .sort((a, b) => a.hour - b.hour);
  },
  getDailyVoiceStats(guildId, daysCount = 7) {
    return Array.from(cache.stats_daily_voice.values())
      .filter((s) => s.guildId === guildId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, daysCount)
      .reverse();
  },

  getSocialAlerts(guildId) {
    return cache.social_alerts.filter((a) => a.guildId === guildId);
  },
  getAllSocialAlerts() {
    return cache.social_alerts;
  },
  addSocialAlert(guildId, platform, channelId, socialId, message) {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const doc = { id, guildId, platform, channelId, socialId, lastVideoId: null, message, changes: 1 };
    cache.social_alerts.push(doc);
    safeCollection('social_alerts')
      .insertOne(doc)
      .catch((err) => logger.error(err));
    return doc;
  },
  removeSocialAlert(id, guildId) {
    cache.social_alerts = cache.social_alerts.filter((a) => !(a.id === id && a.guildId === guildId));
    safeCollection('social_alerts')
      .deleteOne({ id, guildId })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  updateSocialAlertLastVideo(id, lastVideoId) {
    const idx = cache.social_alerts.findIndex((a) => a.id === id);
    if (idx !== -1) {
      cache.social_alerts[idx].lastVideoId = lastVideoId;
      safeCollection('social_alerts')
        .updateOne({ id }, { $set: { lastVideoId } })
        .catch((err) => logger.error(err));
    }
    return { changes: 1 };
  },
  updateSocialAlertSocialId(id, socialId) {
    const idx = cache.social_alerts.findIndex((a) => a.id === id);
    if (idx !== -1) {
      cache.social_alerts[idx].socialId = socialId;
      safeCollection('social_alerts')
        .updateOne({ id }, { $set: { socialId } })
        .catch((err) => logger.error(err));
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
    safeCollection('message_cache')
      .insertOne(doc)
      .catch((err) => logger.error('[DB] Mongo write failed:', err));
  },
  async getCachedMessage(messageId) {
    if (!mongoDb) return null;
    const doc = await safeCollection('message_cache')
      .findOne({ messageId })
      .catch(() => null);
    return doc || null;
  },
  async getKV(key) {
    if (!key || typeof key !== 'string') return null;
    if (!cache.quick_db) cache.quick_db = new Map();
    if (cache.quick_db.has(key)) return cache.quick_db.get(key);
    if (!mongoDb) return null;
    const doc = await safeCollection('quick_db')
      .findOne({ key })
      .catch(() => null);
    if (doc) {
      cache.quick_db.set(key, doc.value);
      return doc.value;
    }
    return null;
  },
  async setKV(key, value) {
    if (!key || typeof key !== 'string') return null;
    let safeVal = value;
    if (typeof safeVal === 'number' && Number.isNaN(safeVal)) safeVal = 0;
    if (!cache.quick_db) cache.quick_db = new Map();
    cache.quick_db.set(key, safeVal);
    if (mongoDb) {
      await safeCollection('quick_db')
        .updateOne({ key }, { $set: { value: safeVal } }, { upsert: true })
        .catch((err) => logger.error('[DB] Mongo write failed:', err));
    }
    return safeVal;
  },
  async deleteKV(key) {
    if (!key || typeof key !== 'string') return false;
    if (!cache.quick_db) cache.quick_db = new Map();
    cache.quick_db.delete(key);
    if (mongoDb) {
      await safeCollection('quick_db')
        .deleteOne({ key })
        .catch((err) => logger.error('[DB] Mongo write failed:', err));
    }
    return true;
  },
  async getTopBalances(limit = 6) {
    if (mongoDb) {
      const docs = await safeCollection('quick_db')
        .find({ key: { $regex: /^balance_/ } })
        .toArray()
        .catch(() => []);
      if (docs.length > 0) {
        return docs
          .map((d) => ({
            userId: d.key.replace('balance_', ''),
            balance: d.value
          }))
          .sort((a, b) => b.balance - a.balance)
          .slice(0, limit);
      }
    }
    if (cache.quick_db) {
      const list = [];
      for (const [k, v] of cache.quick_db.entries()) {
        if (k.startsWith('balance_')) {
          list.push({ userId: k.replace('balance_', ''), balance: v });
        }
      }
      return list.sort((a, b) => b.balance - a.balance).slice(0, limit);
    }
    return [];
  },

  getAutomod(guildId) {
    let row = cache.automod_settings.get(guildId);
    if (!row) {
      row = { guildId, enabled: 0, action: 'delete', words: [], bypass_roles: [] };
      cache.automod_settings.set(guildId, row);
      safeCollection('automod_settings')
        .insertOne(row)
        .catch(() => null);
    }
    return row;
  },

  updateAutomod(guildId, data) {
    const current = this.getAutomod(guildId);
    if (data.enabled !== undefined) current.enabled = data.enabled;
    if (data.action !== undefined) current.action = data.action;
    if (data.words !== undefined) current.words = safeJsonParse(data.words, []);
    if (data.bypass_roles !== undefined) current.bypass_roles = safeJsonParse(data.bypass_roles, []);

    cache.automod_settings.set(guildId, current);
    return safeCollection('automod_settings')
      .updateOne({ guildId }, { $set: stripId(current) }, { upsert: true })
      .then(() => ({ changes: 1 }))
      .catch(() => ({ changes: 0 }));
  },

  isConnected() {
    return !!mongoDb;
  },

  getCustomCommands(guildId) {
    return cache.custom_commands.filter((c) => c.guildId === guildId);
  },
  addCustomCommand(guildId, id, trigger, actions) {
    const newDoc = { id, guildId, trigger, actions };
    cache.custom_commands.push(newDoc);
    safeCollection('custom_commands')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  deleteCustomCommand(guildId, id) {
    cache.custom_commands = cache.custom_commands.filter((c) => !(c.guildId === guildId && c.id === id));
    safeCollection('custom_commands')
      .deleteOne({ guildId, id })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },

  // ═══════════════════════════════════════════
  // Mod Actions (Punishment History)
  // ═══════════════════════════════════════════
  addModAction(guildId, targetId, targetTag, moderatorId, moderatorTag, action, reason, duration) {
    const newDoc = {
      guildId,
      targetId,
      targetTag,
      moderatorId,
      moderatorTag,
      action,
      reason,
      duration: duration || null,
      timestamp: Date.now()
    };
    cache.mod_actions.push(newDoc);
    safeCollection('mod_actions')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return newDoc;
  },
  getModHistory(guildId, targetId, limit = 50) {
    return cache.mod_actions
      .filter((a) => a.guildId === guildId && a.targetId === targetId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
  clearModHistory(guildId, targetId) {
    cache.mod_actions = cache.mod_actions.filter((a) => !(a.guildId === guildId && a.targetId === targetId));
    safeCollection('mod_actions')
      .deleteMany({ guildId, targetId })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },
  getAllModActions(guildId) {
    return cache.mod_actions.filter((a) => a.guildId === guildId);
  },
  clearAllModActions(guildId) {
    cache.mod_actions = cache.mod_actions.filter((a) => a.guildId !== guildId);
    safeCollection('mod_actions')
      .deleteMany({ guildId })
      .catch((err) => logger.error(err));
    return { changes: 1 };
  },

  // ═══════════════════════════════════════════
  // Suggestions
  // ═══════════════════════════════════════════
  getSuggestionSettings(guildId) {
    return cache.suggestion_settings.get(guildId) || null;
  },
  setSuggestionSettings(guildId, data) {
    const doc = { guildId, ...data };
    cache.suggestion_settings.set(guildId, doc);
    safeCollection('suggestion_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return doc;
  },
  addSuggestion(guildId, messageId, userId, userTag, content) {
    const newDoc = {
      guildId,
      messageId,
      userId,
      userTag,
      content,
      status: 'pending',
      reviewedBy: null,
      reviewNote: null,
      timestamp: Date.now()
    };
    cache.suggestions.set(messageId, newDoc);
    safeCollection('suggestions')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return newDoc;
  },
  getSuggestion(messageId) {
    return cache.suggestions.get(messageId) || null;
  },
  updateSuggestionStatus(messageId, status, reviewedBy, reviewNote) {
    const doc = cache.suggestions.get(messageId);
    if (doc) {
      doc.status = status;
      doc.reviewedBy = reviewedBy;
      doc.reviewNote = reviewNote || null;
      cache.suggestions.set(messageId, doc);
    }
    safeCollection('suggestions')
      .updateOne({ messageId }, { $set: { status, reviewedBy, reviewNote: reviewNote || null } })
      .catch((err) => logger.error(err));
  },
  updateSuggestionVotes(messageId, upvoters, downvoters) {
    const doc = cache.suggestions.get(messageId);
    if (doc) {
      doc.upvoters = upvoters;
      doc.downvoters = downvoters;
      cache.suggestions.set(messageId, doc);
    }
    safeCollection('suggestions')
      .updateOne({ messageId }, { $set: { upvoters, downvoters } })
      .catch((err) => logger.error(err));
  },

  // ═══════════════════════════════════════════
  // AFK
  // ═══════════════════════════════════════════
  setAFK(guildId, userId, reason) {
    const key = `${userId}_${guildId}`;
    const doc = { guildId, userId, reason, timestamp: Date.now() };
    cache.afk_users.set(key, doc);
    safeCollection('afk_users')
      .updateOne({ guildId, userId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return doc;
  },
  getAFK(guildId, userId) {
    return cache.afk_users.get(`${userId}_${guildId}`) || null;
  },
  removeAFK(guildId, userId) {
    cache.afk_users.delete(`${userId}_${guildId}`);
    safeCollection('afk_users')
      .deleteOne({ guildId, userId })
      .catch((err) => logger.error(err));
  },
  getAllAFK(guildId) {
    const result = [];
    for (const [, doc] of cache.afk_users) {
      if (doc.guildId === guildId) result.push(doc);
    }
    return result;
  },

  // ═══════════════════════════════════════════
  // Starboard
  // ═══════════════════════════════════════════
  getStarboardSettings(guildId) {
    return cache.starboard_settings.get(guildId) || null;
  },
  setStarboardSettings(guildId, data) {
    const doc = { guildId, ...data };
    cache.starboard_settings.set(guildId, doc);
    safeCollection('starboard_settings')
      .updateOne({ guildId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return doc;
  },
  getStarboardPost(originalMessageId) {
    return cache.starboard_posts.get(originalMessageId) || null;
  },
  addStarboardPost(guildId, originalMessageId, starboardMessageId, stars) {
    const doc = { guildId, originalMessageId, starboardMessageId, stars };
    cache.starboard_posts.set(originalMessageId, doc);
    safeCollection('starboard_posts')
      .insertOne(doc)
      .catch((err) => logger.error(err));
    return doc;
  },
  updateStarboardPost(originalMessageId, stars, starboardMessageId) {
    const doc = cache.starboard_posts.get(originalMessageId);
    if (doc) {
      doc.stars = stars;
      if (starboardMessageId) doc.starboardMessageId = starboardMessageId;
      cache.starboard_posts.set(originalMessageId, doc);
    }
    const update = { stars };
    if (starboardMessageId) update.starboardMessageId = starboardMessageId;
    safeCollection('starboard_posts')
      .updateOne({ originalMessageId }, { $set: update })
      .catch((err) => logger.error(err));
  },
  removeStarboardPost(originalMessageId) {
    cache.starboard_posts.delete(originalMessageId);
    safeCollection('starboard_posts')
      .deleteOne({ originalMessageId })
      .catch((err) => logger.error(err));
  },

  // ═══════════════════════════════════════════
  // Sticky Messages
  // ═══════════════════════════════════════════
  getStickyMessage(channelId) {
    return cache.sticky_messages.get(channelId) || null;
  },
  setStickyMessage(guildId, channelId, content) {
    const doc = { guildId, channelId, content, lastMessageId: null, enabled: true };
    cache.sticky_messages.set(channelId, doc);
    safeCollection('sticky_messages')
      .updateOne({ channelId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error(err));
    return doc;
  },
  updateStickyMessageId(channelId, messageId) {
    const doc = cache.sticky_messages.get(channelId);
    if (doc) {
      doc.lastMessageId = messageId;
      cache.sticky_messages.set(channelId, doc);
    }
    safeCollection('sticky_messages')
      .updateOne({ channelId }, { $set: { lastMessageId: messageId } })
      .catch((err) => logger.error(err));
  },
  removeStickyMessage(channelId) {
    cache.sticky_messages.delete(channelId);
    safeCollection('sticky_messages')
      .deleteOne({ channelId })
      .catch((err) => logger.error(err));
  },
  getAllStickyMessages(guildId) {
    return Array.from(cache.sticky_messages.values()).filter((m) => m.guildId === guildId);
  },

  // ═══════════════════════════════════════════
  // Form Submissions
  // ═══════════════════════════════════════════
  addFormSubmission(guildId, formId, userId, userTag, answers) {
    const newDoc = {
      guildId,
      formId,
      userId,
      userTag,
      answers,
      status: 'pending',
      reviewedBy: null,
      reviewNote: null,
      timestamp: Date.now()
    };
    cache.form_submissions.push(newDoc);
    safeCollection('form_submissions')
      .insertOne(newDoc)
      .catch((err) => logger.error(err));
    return newDoc;
  },
  getFormSubmission(guildId, formId, userId) {
    return (
      cache.form_submissions.find(
        (s) => s.guildId === guildId && s.formId === formId && s.userId === userId && s.status === 'pending'
      ) || null
    );
  },
  getFormSubmissions(guildId, formId) {
    return cache.form_submissions.filter((s) => s.guildId === guildId && s.formId === formId);
  },
  updateFormSubmissionStatus(guildId, formId, userId, status, reviewedBy, reviewNote) {
    const idx = cache.form_submissions.findIndex(
      (s) => s.guildId === guildId && s.formId === formId && s.userId === userId && s.status === 'pending'
    );
    if (idx !== -1) {
      cache.form_submissions[idx].status = status;
      cache.form_submissions[idx].reviewedBy = reviewedBy;
      cache.form_submissions[idx].reviewNote = reviewNote || null;
    }
    safeCollection('form_submissions')
      .updateOne(
        { guildId, formId, userId, status: 'pending' },
        { $set: { status, reviewedBy, reviewNote: reviewNote || null } }
      )
      .catch((err) => logger.error(err));
  },

  // ── Booster Roles System ──────────────────────────────
  getBoosterRole(guildId, userId) {
    return cache.booster_roles.get(`${guildId}_${userId}`) || null;
  },
  getBoosterRoleByRoleId(guildId, roleId) {
    for (const doc of cache.booster_roles.values()) {
      if (doc.guildId === guildId && doc.roleId === roleId) return doc;
    }
    return null;
  },
  getAllBoosterRoles(guildId) {
    return Array.from(cache.booster_roles.values()).filter((r) => r.guildId === guildId);
  },
  setBoosterRole(guildId, userId, roleData) {
    const key = `${guildId}_${userId}`;
    const doc = { guildId, userId, ...roleData, updatedAt: Date.now() };
    cache.booster_roles.set(key, doc);
    safeCollection('booster_roles')
      .updateOne({ guildId, userId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error('[DB booster_roles set]', err));
    return doc;
  },
  deleteBoosterRole(guildId, userId) {
    const key = `${guildId}_${userId}`;
    const existed = cache.booster_roles.delete(key);
    safeCollection('booster_roles')
      .deleteOne({ guildId, userId })
      .catch((err) => logger.error('[DB booster_roles delete]', err));
    return existed;
  },
  addBoosterRoleShare(guildId, userId, friendId) {
    const role = helpers.getBoosterRole(guildId, userId);
    if (!role) return false;
    const shared = new Set(role.sharedWith || []);
    shared.add(friendId);
    role.sharedWith = Array.from(shared);
    helpers.setBoosterRole(guildId, userId, role);
    return true;
  },
  removeBoosterRoleShare(guildId, userId, friendId) {
    const role = helpers.getBoosterRole(guildId, userId);
    if (!role) return false;
    role.sharedWith = (role.sharedWith || []).filter((id) => id !== friendId);
    helpers.setBoosterRole(guildId, userId, role);
    return true;
  },

  // ── Server Role Shop ─────────────────────────────────
  getShopRoles(guildId) {
    return Array.from(cache.shop_roles.values()).filter((r) => r.guildId === guildId);
  },
  getShopRole(guildId, roleId) {
    return cache.shop_roles.get(`${guildId}_${roleId}`) || null;
  },
  addShopRole(guildId, roleId, price, description = '') {
    const key = `${guildId}_${roleId}`;
    const doc = {
      guildId,
      roleId,
      price: Number(price),
      description: description || '',
      addedAt: Date.now()
    };
    cache.shop_roles.set(key, doc);
    safeCollection('shop_roles')
      .updateOne({ guildId, roleId }, { $set: stripId(doc) }, { upsert: true })
      .catch((err) => logger.error('[DB shop_roles add]', err));
    return doc;
  },
  removeShopRole(guildId, roleId) {
    const key = `${guildId}_${roleId}`;
    const existed = cache.shop_roles.delete(key);
    safeCollection('shop_roles')
      .deleteOne({ guildId, roleId })
      .catch((err) => logger.error('[DB shop_roles remove]', err));
    return existed;
  },
  addShopTransaction(guildId, userId, roleId, price) {
    const doc = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      guildId,
      userId,
      roleId,
      price: Number(price),
      timestamp: Date.now()
    };
    cache.shop_transactions.push(doc);
    if (cache.shop_transactions.length > 5000) {
      cache.shop_transactions = cache.shop_transactions.slice(-5000);
    }
    safeCollection('shop_transactions')
      .insertOne(doc)
      .catch((err) => logger.error('[DB shop_transactions insert]', err));
    return doc;
  },
  recordShopTransaction(guildId, userId, roleId, price) {
    return this.addShopTransaction(guildId, userId, roleId, price);
  },

  // ── Daily Quests System ──────────────────────────────
  getDailyQuests(userId, dateStr = new Date().toISOString().slice(0, 10)) {
    const key = `${userId}_${dateStr}`;
    let doc = cache.daily_quests.get(key);
    if (!doc) {
      doc = {
        userId,
        date: dateStr,
        progress: {
          chat: 0,
          voice: 0,
          transfer: 0,
          daily: 0
        },
        claimed: {
          chat: false,
          voice: false,
          transfer: false,
          daily: false
        }
      };
      cache.daily_quests.set(key, doc);
      safeCollection('daily_quests')
        .insertOne(doc)
        .catch(() => null);
    }
    return doc;
  },
  incrementQuestProgress(userId, questType, amount = 1, dateStr = new Date().toISOString().slice(0, 10)) {
    const doc = helpers.getDailyQuests(userId, dateStr);
    if (doc && doc.progress) {
      doc.progress[questType] = (doc.progress[questType] || 0) + amount;
      cache.daily_quests.set(`${userId}_${dateStr}`, doc);
      safeCollection('daily_quests')
        .updateOne({ userId, date: dateStr }, { $set: stripId(doc) }, { upsert: true })
        .catch(() => null);
    }
    return doc;
  },
  claimDailyQuest(userId, questType, dateStr = new Date().toISOString().slice(0, 10)) {
    const doc = helpers.getDailyQuests(userId, dateStr);
    if (doc && doc.claimed) {
      doc.claimed[questType] = true;
      cache.daily_quests.set(`${userId}_${dateStr}`, doc);
      safeCollection('daily_quests')
        .updateOne({ userId, date: dateStr }, { $set: stripId(doc) }, { upsert: true })
        .catch(() => null);
    }
    return doc;
  }
};

helpers.stripId = stripId;
helpers.safeSet = safeSet;
helpers.client = client;
helpers.prepare = (sql) => helpers.db.prepare(sql);
module.exports = helpers;
if (typeof logger.setDb === 'function') {
  logger.setDb(helpers);
}
