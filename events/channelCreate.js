const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog, logger } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    try {
      if (!channel?.guild) return;

      const embed = new EmbedBuilder()
        .setTitle('{emoji:circlecheck} تم إنشاء روم')
        .addFields(
          { name: 'اسم الروم', value: `<#${channel.id}>`, inline: true },
          { name: 'النوع', value: channel.type.toString(), inline: true }
        )
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: `ID: ${channel.id}` });

      await sendLog(channel.client, channel.guild.id, embed, 'channel_create');

      try {
        const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
        const entry = logs.entries.first();
        if (entry && entry.target?.id === channel.id && Date.now() - entry.createdTimestamp < 15000) {
          await handleLimit(channel.guild, entry.executor, 'channel', 'channel_limit', 'تجاوز حد القنوات');
        }
      } catch (error) {
        // Ignore errors in audit log fetching - not critical
        logger.debug('Could not fetch audit log for channel create:', error.message);
      }
    } catch (err) {
      logger.error('Error in channelCreate event:', err);
    }
  }
};
