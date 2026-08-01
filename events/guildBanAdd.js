const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog, logger } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    try {
      if (!ban?.user || !ban?.guild) return;

      const embed = new EmbedBuilder()
        .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
        .setTitle('{emoji:shield} تم حظر عضو (Ban)')
        .addFields(
          { name: 'العضو', value: `<@${ban.user.id}>`, inline: true },
          { name: 'السبب', value: ban.reason || 'بدون سبب', inline: true }
        )
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: `ID: ${ban.user.id}` });

      await sendLog(ban.client, ban.guild.id, embed, 'ban');

      try {
        const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
        const entry = logs.entries.first();
        if (entry && entry.target?.id === ban.user.id && Date.now() - entry.createdTimestamp < 15000) {
          await handleLimit(ban.guild, entry.executor, 'ban', 'ban_limit', 'تجاوز حد الباند');
        }
      } catch (error) {
        // Ignore errors in audit log fetching - not critical
        logger.debug('Could not fetch audit log for ban add:', error.message);
      }
    } catch (err) {
      logger.error('Error in guildBanAdd event:', err);
    }
  }
};
