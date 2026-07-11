const db = require('../database/db');
const { checkLevelUp } = require('../utils/levels');
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (!newState.member || newState.member.user.bot) return;

    const guildId = newState.guild.id;
    const userId = newState.member.id;

    
    if (newState.channelId) {
      const tvChan = db.getTempVoiceChannel(newState.channelId);
      if (tvChan && db.isTempVoiceBanned(newState.channelId, userId)) {
        await newState.member.voice.disconnect().catch(() => null);
        return;
      }
    }

    const isJoining = !oldState.channelId && newState.channelId;
    const isLeaving = oldState.channelId && !newState.channelId;
    const isSwitching = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    const sessionKey = `${guildId}:${userId}`;

    if (isLeaving || isSwitching) {
      const startTime = newState.client.voiceSessions.get(sessionKey);
      if (startTime) {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        newState.client.voiceSessions.delete(sessionKey);

        if (durationSeconds > 0) {
          db.addVoiceXP(userId, guildId, durationSeconds);
          db.addDailyVoiceSeconds(guildId, durationSeconds);
          await checkLevelUp(newState.client, userId, guildId);
        }
      }

      const oldChannel = oldState.channel;
      if (oldChannel) {
        const tempChannelData = db.getTempVoiceChannel(oldChannel.id);
        if (tempChannelData) {
          if (oldChannel.members.size === 0) {
            try {
              await oldChannel.delete();
              db.removeTempVoiceChannel(oldChannel.id);
            } catch (error) {
              console.error('[TempVoice] Error deleting empty channel:', error);
            }
          }
        }
      }
    }

    if (isJoining || isSwitching) {
      newState.client.voiceSessions.set(sessionKey, Date.now());

      const tvSettings = db.getTempVoiceSettings(guildId);
      if (tvSettings && tvSettings.master_channel === newState.channelId) {
        try {
          const userSavedSettings = db.getTempVoiceUserSettings(userId);
          const channelName = userSavedSettings?.preferredName || `🔊・${newState.member.displayName}`;
          const channelLimit = userSavedSettings?.preferredLimit !== undefined ? userSavedSettings.preferredLimit : 0;

          const newChannel = await newState.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: tvSettings.category_id,
            userLimit: channelLimit,
            permissionOverwrites: [
              {
                id: newState.guild.id,
                allow: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: userId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels],
              }
            ]
          });

          await newState.member.voice.setChannel(newChannel);
          db.addTempVoiceChannel(newChannel.id, userId, guildId);

          if (tvSettings.panel_channel) {
            await newChannel.send({ content: `<@${userId}> مبروك غرفتك الصوتية الجديدة يمكنك التحكم بالروم الخاصة بك من خلال روم التحكم <#${tvSettings.panel_channel}>` }).catch(() => null);
          } else {
            const { AttachmentBuilder } = require('discord.js');
            const { generateTVControlPanel } = require('../utils/tvCanvas');
            const emojis = require('../utils/emojis.json');
            
            const buffer = await generateTVControlPanel();
            const attachment = new AttachmentBuilder(buffer, { name: 'control_panel.png' });

            const row1 = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('tv_lock').setEmoji(emojis.tv_lock || '🔒').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tv_unlock').setEmoji(emojis.tv_unlock || '🔓').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tv_hide').setEmoji(emojis.tv_hide || '👁️‍🗨️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tv_show').setEmoji(emojis.tv_show || '👁️').setStyle(ButtonStyle.Secondary)
            );

             const row2 = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('tv_limit').setEmoji(emojis.tv_limit || '👥').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tv_rename').setEmoji(emojis.tv_rename || '✏️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tv_kick').setEmoji(emojis.tv_kick || '👢').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tv_trust').setEmoji(emojis.tv_trust || '👑').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tv_ban').setEmoji(emojis.tv_ban || '🚫').setStyle(ButtonStyle.Secondary)
            );

            await newChannel.send({ content: `<@${userId}>`, files: [attachment], components: [row1, row2] }).catch(() => null);
          }

        } catch (error) {
          console.error('[TempVoice] Error creating channel:', error);
        }
      }
    }
  }
};
