const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog, logger } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');
const db = require('../database/db');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    try {
      if (!channel?.guild) return;

      // Clean up temporary voice or ticket state if deleted channel matches
      try {
        db.removeTempVoiceChannel(channel.id);
        const ticket = db.getTicketByChannel(channel.id);
        if (ticket && ticket.status !== 'closed') {
          db.closeTicket(channel.id, 'channel_deleted', 'Channel was deleted manually');
        }
      } catch (dbErr) {
        logger.debug('[ChannelDelete] DB cleanup error:', dbErr.message);
      }

      const embed = new EmbedBuilder()
        .setTitle('{emoji:circlex} تم حذف روم')
        .addFields({ name: 'اسم الروم', value: channel.name, inline: true })
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: `ID: ${channel.id}` });

      await sendLog(channel.client, channel.guild.id, embed, 'channel_delete');

      try {
        const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
        const entry = logs.entries.first();
        if (entry && entry.target?.id === channel.id && Date.now() - entry.createdTimestamp < 15000) {
          await handleLimit(channel.guild, entry.executor, 'channel', 'channel_limit', 'تجاوز حد القنوات');
        }
      } catch (error) {
        // Ignore errors in audit log fetching - not critical
        logger.debug('Could not fetch audit log for channel delete:', error.message);
      }
    } catch (err) {
      logger.error('Error in channelDelete event:', err);
    }
  }
};
