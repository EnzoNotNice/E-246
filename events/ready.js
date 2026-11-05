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
              const isBooster = Boolean(voiceState.member?.premiumSince);
              const xpSeconds = isBooster ? Math.floor(durationSeconds * 1.5) : durationSeconds;
              db.addVoiceXP(userId, guildId, xpSeconds);
              db.addDailyVoiceSeconds(guildId, durationSeconds);
              db.incrementQuestProgress(userId, 'voice', durationSeconds);
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

      // 🕒 Stale Ticket Periodic Auto-Close Checker (every 5 minutes)
      const discordTranscripts = require('discord-html-transcripts');
      setInterval(async () => {
        try {
          const now = Date.now();
          const openTickets = db.getOpenTickets();
          for (const ticket of openTickets) {
            const lastActivity = ticket.lastMessageAt || ticket.created_at * 1000 || now;
            const diff = now - lastActivity;
            const channel = client.channels.cache.get(ticket.channelId);
            if (!channel) continue;

            // 1. 24h Warning
            if (diff >= 86400000 && !ticket.staleWarned) {
              db.markTicketStaleWarned(ticket.channelId);
              const warnEmbed = new (require('discord.js').EmbedBuilder)()
                .setColor(0xf59e0b)
                .setTitle('{emoji:clock} تنبيه خمول التذكرة')
                .setDescription(
                  '⚠️ لم يتم تسجيل أي نشاط أو رسائل في هذه التذكرة منذ أكثر من **24 ساعة**.\n' +
                    'إذا لم يتم التفاعل خلال **24 ساعة قادمة**، سيتم إغلاق التذكرة وأرشفتها تلقائياً.'
                )
                .setTimestamp();
              await channel.send({ embeds: [warnEmbed] }).catch(() => null);
            }

            // 2. 48h Auto-Close
            if (diff >= 172800000 && ticket.staleWarned) {
              const settings = await db.getTicketSettings(ticket.guildId);
              try {
                const transcriptHtml = await discordTranscripts.createTranscript(channel, {
                  limit: -1,
                  returnType: 'string',
                  filename: `${channel.name}.html`
                });
                db.saveWebTranscript(ticket.guildId, ticket.channelId, ticket.userId, channel.name, transcriptHtml);

                const logCh =
                  client.channels.cache.get(settings?.log_channel) ||
                  (await client.channels.fetch(settings?.log_channel).catch(() => null));
                if (logCh) {
                  const { AttachmentBuilder } = require('discord.js');
                  const attachment = new AttachmentBuilder(Buffer.from(transcriptHtml, 'utf-8'), {
                    name: `${channel.name}.html`
                  });
                  await logCh
                    .send({
                      content: `⏰ **تم إغلاق تذكرة خاملة تلقائياً (48 ساعة بدون رد):** \`${channel.name}\``,
                      files: [attachment]
                    })
                    .catch(() => null);
                }
              } catch (err) {
                logger.error('[Stale Ticket Transcript Error]:', err);
              }

              db.closeTicket(ticket.channelId, client.user.id, 'Auto-closed due to 48 hours inactivity');
              await channel
                .send({
                  content: '🔒 تم إغلاق التذكرة تلقائياً بسبب الخمول لأكثر من 48 ساعة. سيتم حذف القناة خلال لحظات...'
                })
                .catch(() => null);
              setTimeout(() => {
                channel.delete('Auto-close stale ticket').catch(() => null);
              }, 5000);
            }
          }
        } catch (err) {
          logger.error('[Stale Ticket Checker Error]:', err);
        }
      }, 300000);
    } catch (err) {
      logger.error('Error in ready event execute:', err);
    }
  }
};
