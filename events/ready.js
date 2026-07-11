const { Events } = require('discord.js');
const emojiSetup = require('../utils/emojiSetup');
const db = require('../database/db');
const { checkLevelUp } = require('../utils/levels');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} server(s)`);
    console.log(`Watching ${client.users.cache.size} user(s)`);

    if (client.manager) {
      client.manager.init({ id: client.user.id, username: client.user.username });
      client.on('raw', (d) => client.manager.sendRawData(d));
    }

    
    await emojiSetup(client);

    const { getBotSettings } = require('../database/db');
    const botSettings = getBotSettings();
    const { ActivityType } = require('discord.js');
    const actType = ActivityType[botSettings.activity_type] || ActivityType.Playing;

    try {
        client.user.setPresence({
            activities: [{ name: botSettings.activity_name, type: actType }],
            status: botSettings.status,
        });
    } catch (err) {
        console.error('[Ready] Failed to set bot presence:', err.message || err);
    }

    for (const [, guild] of client.guilds.cache) {
      try {
        const invites = await guild.invites.fetch();
        client.inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
      } catch (e) {
      }
    }
    let voiceCount = 0;
    for (const [, guild] of client.guilds.cache) {
      for (const [, voiceState] of guild.voiceStates.cache) {
        if (!voiceState.member || voiceState.member.user.bot) continue;
        const sessionKey = `${guild.id}:${voiceState.member.id}`;
        client.voiceSessions.set(sessionKey, Date.now());
        voiceCount++;
      }
    }
    console.log(`Initialized ${voiceCount} voice session(s)`);

    const { getAllActiveGiveaways, endGiveaway } = require('../database/db');
    const { endGiveawayTimer } = require('../utils/giveaway');
    const giveaways = getAllActiveGiveaways();
    for (const g of giveaways) {
      const remaining = g.endTime * 1000 - Date.now();
      if (remaining <= 0) {
        await endGiveawayTimer(client, g).catch(() => null);
      } else {
        setTimeout(() => endGiveawayTimer(client, g), remaining);
      }
    }
    console.log(`Resumed ${giveaways.length} active giveaway(s)`);

    setInterval(async () => {
      const now = Date.now();
      for (const [sessionKey, startTime] of client.voiceSessions.entries()) {
        const [guildId, userId] = sessionKey.split(':');
        const durationSeconds = Math.floor((now - startTime) / 1000);
        if (durationSeconds > 0) {
          db.addVoiceXP(userId, guildId, durationSeconds);
          db.addDailyVoiceSeconds(guildId, durationSeconds);
          client.voiceSessions.set(sessionKey, now);
          await checkLevelUp(client, userId, guildId);
        }
      }
    }, 60000);
  }
};
