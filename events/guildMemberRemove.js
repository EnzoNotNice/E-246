const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../database/db');
const { sendLog, logger } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      if (!member?.guild) return;
      const guildId = member.guild.id;
      const client = member.client;

      db.incrementDailyLeaves(guildId);

      try {
        const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
        const entry = logs.entries.first();
        if (entry && entry.target?.id === member.id && Date.now() - entry.createdTimestamp < 15000) {
          await handleLimit(member.guild, entry.executor, 'kick', 'kick_limit', 'تجاوز حد الكيك');
        }
      } catch (error) {
        // Ignore errors in audit log fetching - not critical
        logger.debug('Could not fetch audit log for member remove kick:', error.message);
      }

      try {
        const inviteLogs = db.getInviteLogs(guildId);
        if (inviteLogs?.channelId) {
          const logCh = await client.channels.fetch(inviteLogs.channelId).catch(() => null);
          if (logCh) {
            const leaveEmbed = new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('{emoji:mail} مغادرة عضو')
              .setThumbnail(member.user ? member.user.displayAvatarURL() : member.displayAvatarURL())
              .setDescription(
                `${member.user ? member.user.tag : 'عضو غير معروف'} غادر السيرفر\n**عدد الأعضاء** ${member.guild.memberCount}`
              )
              .setTimestamp();
            logCh.send({ embeds: [leaveEmbed] }).catch(() => null);
          }
        }
      } catch (error) {
        // Ignore errors in invite logging - not critical
        logger.debug('Could not send invite log for member remove:', error.message);
      }

      const joinedUnix = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
      const userTag = member.user ? member.user.tag : 'عضو غير معروف';
      const userId = member.user ? member.user.id : member.id;
      const avatarUrl = member.user ? member.user.displayAvatarURL({ size: 256 }) : member.displayAvatarURL();
      const rolesList =
        member.roles?.cache
          ?.filter((r) => r.id !== member.guild.id)
          .map((r) => `<@&${r.id}>`)
          .join(' ') || 'لا يوجد';

      const logEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('{emoji:mail} مغادرة عضو')
        .setThumbnail(avatarUrl)
        .addFields(
          { name: 'العضو', value: `${userTag}`, inline: true },
          { name: 'معرف العضو', value: `\`${userId}\``, inline: true },
          {
            name: 'تاريخ انضمامه كان',
            value: joinedUnix ? `<t:${joinedUnix}:R> (<t:${joinedUnix}:F>)` : 'غير متاح',
            inline: false
          },
          { name: 'الرتب السابقة', value: rolesList.substring(0, 1024), inline: false },
          { name: 'الأعضاء المتبقين', value: `\`${member.guild.memberCount}\``, inline: true }
        )
        .setTimestamp();

      await sendLog(client, guildId, logEmbed, 'member_leave');
    } catch (err) {
      logger.error('Error in guildMemberRemove event:', err);
    }
  }
};
