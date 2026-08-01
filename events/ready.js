const { Events } = require('discord.js');
const emojiSetup = require('../utils/emojiSetup');
const db = require('../database/db');
const { checkLevelUp } = require('../utils/levels');
const { logger } = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      logger.info(`Logged in as ${client?.user?.tag}`);
      logger.info(`Serving ${client?.guilds?.cache?.size || 0} server(s)`);
      logger.info(`Watching ${client?.users?.cache?.size || 0} user(s)`);

      if (client?.manager) {
        try {
          client.manager.init({ id: client.user.id, username: client.user.username });
          client.on('raw', (d) => client.manager.sendRawData(d));
        } catch (e) {
          logger.error('[Lavalink Init Error]', e);
        }
      }

      await emojiSetup(client).catch((e) => logger.error('[Emoji Setup Error]', e));

      const { getBotSettings } = require('../database/db');
      const botSettings = getBotSettings();
      const { ActivityType } = require('discord.js');
      const actType = ActivityType[botSettings.activity_type] || ActivityType.Playing;

      try {
        client.user.setPresence({
          activities: [{ name: botSettings.activity_name, type: actType }],
          status: botSettings.status
        });
      } catch (err) {
        logger.error('[Ready] Failed to set bot presence:', err.message || err);
      }

      if (client.guilds?.cache) {
        for (const [, guild] of client.guilds.cache) {
          try {
            const invites = await guild.invites.fetch();
            client.inviteCache.set(guild.id, new Map(invites.map((i) => [i.code, i.uses])));
          } catch (error) {
            // Ignore errors in fetching invites - not critical for bot operation
            logger.debug('Could not fetch invites for guild:', error.message);
          }
        }
      }
      let voiceCount = 0;
      if (client.guilds?.cache) {
        for (const [, guild] of client.guilds.cache) {
          for (const [, voiceState] of guild.voiceStates.cache) {
            if (!voiceState.member || voiceState.member.user?.bot) continue;
            const isActive =
              voiceState.channelId &&
              voiceState.channelId !== guild.afkChannelId &&
              !voiceState.selfMute &&
              !voiceState.serverMute &&
              !voiceState.selfDeaf &&
              !voiceState.serverDeaf;
            if (isActive) {
              const sessionKey = `${guild.id}:${voiceState.member.id}`;
              client.voiceSessions.set(sessionKey, Date.now());
              voiceCount++;
            }
          }
        }
      }
      logger.info(`Initialized ${voiceCount} voice session(s)`);

      const { getAllActiveGiveaways } = require('../database/db');
      const { endGiveawayTimer } = require('../utils/giveaway');
      const giveaways = getAllActiveGiveaways() || [];
      for (const g of giveaways) {
        const remaining = g.endTime * 1000 - Date.now();
        if (remaining <= 0) {
          await endGiveawayTimer(client, g).catch(() => null);
        } else {
          setTimeout(async () => {
            try {
              await endGiveawayTimer(client, g);
            } catch (err) {
              logger.error('[Giveaway Timer Error]:', err);
            }
          }, remaining);
        }
      }
      logger.info(`Resumed ${giveaways.length} active giveaway(s)`);

      setInterval(async () => {
        try {
          const now = Date.now();
          if (!client?.voiceSessions) return;
          for (const [sessionKey, startTime] of client.voiceSessions.entries()) {
            const [guildId, userId] = sessionKey.split(':');
            const guild = client.guilds.cache.get(guildId);
            const member = guild ? guild.members.cache.get(userId) : null;
            const voiceState = member ? member.voice : null;

            const isActive =
              voiceState &&
              voiceState.channelId &&
              voiceState.channelId !== guild.afkChannelId &&
              !voiceState.selfMute &&
              !voiceState.serverMute &&
              !voiceState.selfDeaf &&
              !voiceState.serverDeaf;

            if (!isActive) {
              client.voiceSessions.delete(sessionKey);
              continue;
            }

            const durationSeconds = Math.floor((now - startTime) / 1000);
            if (durationSeconds > 0) {
              db.addVoiceXP(userId, guildId, durationSeconds);
              db.addDailyVoiceSeconds(guildId, durationSeconds);
              client.voiceSessions.set(sessionKey, now);
              await checkLevelUp(client, userId, guildId);
            }
          }
        } catch (err) {
          logger.error('Error in ready voice XP interval:', err);
        }
      }, 60000);

      try {
        const { initBackupScheduler } = require('../utils/backupScheduler');
        initBackupScheduler();
      } catch (err) {
        logger.error('[Ready] Failed to initialize database backup scheduler:', err);
      }
    } catch (err) {
      logger.error('Error in ready event execute:', err);
    }
  }
};
