const db = require('../database/db');
const logger = require('../utils/logger');
const { checkLevelUp } = require('../utils/levels');
const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    try {
      const member = newState.member || oldState.member;
      if (!member || member.user?.bot) return;

      const guild = newState.guild || oldState.guild;
      if (!guild) return;
      const guildId = guild.id;
      const userId = member.id;

      if (newState.channelId) {
        const tvChan = db.getTempVoiceChannel(newState.channelId);
        if (tvChan && db.isTempVoiceBanned(newState.channelId, userId)) {
          await member.voice?.disconnect().catch(() => null);
          return;
        }
      }

      const isJoining = !oldState.channelId && newState.channelId;
      const isLeaving = oldState.channelId && !newState.channelId;
      const isSwitching = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

      const { sendLog } = require('../utils/logger');
      if (isJoining) {
        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('{emoji:music_play} دخول روم صوتي')
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: 'العضو', value: `${member} (${member.user.tag})`, inline: true },
            { name: 'معرف العضو', value: `\`${userId}\``, inline: true },
            { name: 'الروم الصوتي', value: `<#${newState.channelId}>`, inline: false }
          )
          .setTimestamp();
        await sendLog(newState.client, guildId, embed, 'voice').catch(() => null);
      } else if (isLeaving) {
        const leavingMember = oldState.member || newState.member;
        if (leavingMember?.user) {
          const embed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('{emoji:music_play} خروج من روم صوتي')
            .setThumbnail(leavingMember.user.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: 'العضو', value: `${leavingMember} (${leavingMember.user.tag})`, inline: true },
              { name: 'معرف العضو', value: `\`${userId}\``, inline: true },
              { name: 'الروم الصوتي', value: `<#${oldState.channelId}>`, inline: false }
            )
            .setTimestamp();
          await sendLog(oldState.client, guildId, embed, 'voice').catch(() => null);
        }
      } else if (isSwitching) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('{emoji:music_play} انتقال بين رومات صوتية')
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: 'العضو', value: `${member} (${member.user.tag})`, inline: true },
            { name: 'معرف العضو', value: `\`${userId}\``, inline: true },
            { name: 'من الروم', value: `<#${oldState.channelId}>`, inline: true },
            { name: 'إلى الروم', value: `<#${newState.channelId}>`, inline: true }
          )
          .setTimestamp();
        await sendLog(newState.client, guildId, embed, 'voice').catch(() => null);
      }

      const sessionKey = `${guildId}:${userId}`;

      const oldActive = !!(
        oldState.channelId &&
        oldState.channelId !== oldState.guild.afkChannelId &&
        !oldState.selfMute &&
        !oldState.serverMute &&
        !oldState.selfDeaf &&
        !oldState.serverDeaf
      );
      const newActive = !!(
        newState.channelId &&
        newState.channelId !== newState.guild.afkChannelId &&
        !newState.selfMute &&
        !newState.serverMute &&
        !newState.selfDeaf &&
        !newState.serverDeaf
      );
      const channelSwitched = !!(oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId);

      const shouldEndSession = (oldActive && !newActive) || (oldActive && channelSwitched);
      const shouldStartSession = (!oldActive && newActive) || (newActive && channelSwitched);

      if (shouldEndSession) {
        const startTime = newState.client.voiceSessions.get(sessionKey);
        if (startTime) {
          const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
          newState.client.voiceSessions.delete(sessionKey);

          if (durationSeconds > 0) {
            let xpSeconds = durationSeconds;
            const isBooster = Boolean(oldState.member?.premiumSince || newState.member?.premiumSince);
            if (isBooster) {
              xpSeconds = Math.floor(durationSeconds * 1.5);
            }
            db.addVoiceXP(userId, guildId, xpSeconds);
            db.addDailyVoiceSeconds(guildId, durationSeconds);
            db.incrementQuestProgress(userId, 'voice', durationSeconds);
            await checkLevelUp(newState.client, userId, guildId);
          }
        }
      }

      if (shouldStartSession) {
        newState.client.voiceSessions.set(sessionKey, Date.now());
      }

      if (isLeaving || isSwitching) {
        const oldChannel = oldState.channel;
        if (oldChannel) {
          const tempChannelData = db.getTempVoiceChannel(oldChannel.id);
          if (tempChannelData) {
            if (oldChannel.members.size === 0) {
              try {
                await oldChannel.delete();
                db.removeTempVoiceChannel(oldChannel.id);
              } catch (error) {
                logger.error('[TempVoice] Error deleting empty channel:', error);
              }
            }
          }
        }
      }

      if (isJoining || isSwitching) {
        const tvSettings = db.getTempVoiceSettings(guildId);
        if (tvSettings && tvSettings.master_channel === newState.channelId) {
          try {
            const userSavedSettings = db.getTempVoiceUserSettings(userId);
            const channelName = userSavedSettings?.preferredName || `🔊・${newState.member.displayName}`;
            const channelLimit = userSavedSettings?.preferredLimit !== undefined ? userSavedSettings.preferredLimit : 0;
            const isBooster = Boolean(newState.member?.premiumSince);
            const maxBitrate = newState.guild.maximumBitrate || 96000;

            const channelCreatePayload = {
              name: channelName,
              type: ChannelType.GuildVoice,
              parent: tvSettings.category_id,
              userLimit: channelLimit,
              permissionOverwrites: [
                {
                  id: newState.guild.id,
                  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                },
                {
                  id: userId,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.MoveMembers,
                    PermissionFlagsBits.MuteMembers,
                    PermissionFlagsBits.DeafenMembers
                  ]
                }
              ]
            };

            // Booster Perk: Set maximum voice bitrate supported by the guild
            if (isBooster && maxBitrate) {
              channelCreatePayload.bitrate = maxBitrate;
            }

            const newChannel = await newState.guild.channels.create(channelCreatePayload);
            db.addTempVoiceChannel(newChannel.id, userId, guildId);

            try {
              await newState.member.voice.setChannel(newChannel);
            } catch (moveErr) {
              if (newChannel.members.size === 0) {
                await newChannel.delete().catch(() => null);
                db.removeTempVoiceChannel(newChannel.id);
                return;
              }
            }

            if (tvSettings.panel_channel) {
              await newChannel
                .send({
                  content: `<@${userId}> مبروك غرفتك الصوتية الجديدة يمكنك التحكم بالروم الخاصة بك من خلال روم التحكم <#${tvSettings.panel_channel}>`
                })
                .catch(() => null);
            } else {
              const { AttachmentBuilder } = require('discord.js');
              const { generateTVControlPanel } = require('../utils/tvCanvas');
              const emojis = require('../utils/emojis.json');

              const buffer = await generateTVControlPanel();
              const attachment = new AttachmentBuilder(buffer, { name: 'control_panel.png' });

              const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('tv_lock')
                  .setEmoji(emojis.tv_lock || '🔒')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('tv_unlock')
                  .setEmoji(emojis.tv_unlock || '🔓')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('tv_hide')
                  .setEmoji(emojis.tv_hide || '👁️‍🗨️')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('tv_show')
                  .setEmoji(emojis.tv_show || '👁️')
                  .setStyle(ButtonStyle.Secondary)
              );

              const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('tv_limit')
                  .setEmoji(emojis.tv_limit || '👥')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('tv_rename')
                  .setEmoji(emojis.tv_rename || '✏️')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('tv_kick')
                  .setEmoji(emojis.tv_kick || '👢')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('tv_trust')
                  .setEmoji(emojis.tv_trust || '👑')
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('tv_ban')
                  .setEmoji(emojis.tv_ban || '🚫')
                  .setStyle(ButtonStyle.Secondary)
              );

              await newChannel
                .send({ content: `<@${userId}>`, files: [attachment], components: [row1, row2] })
                .catch(() => null);
            }
          } catch (error) {
            logger.error('[TempVoice] Error creating channel:', error);
          }
        }
      }
    } catch (err) {
      logger.error('[Event Error - voiceStateUpdate]:', err);
    }
  }
};
