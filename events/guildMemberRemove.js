const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../database/db');
const { sendLog } = require('../utils/logger');
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
      } catch (_) {}

      try {
        const inviteLogs = db.getInviteLogs(guildId);
        if (inviteLogs?.channelId) {
          const logCh = await client.channels.fetch(inviteLogs.channelId).catch(() => null);
          if (logCh) {
            const leaveEmbed = new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('{emoji:mail} مغادرة عضو')
              .setThumbnail(member.user ? member.user.displayAvatarURL() : member.displayAvatarURL())
              .setDescription(`${member.user ? member.user.tag : 'عضو غير معروف'} غادر السيرفر\n**عدد الأعضاء** ${member.guild.memberCount}`)
              .setTimestamp();
            logCh.send({ embeds: [leaveEmbed] }).catch(() => null);
          }
        }
      } catch (_) {}

      const logEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('{emoji:mail} مغادرة عضو')
        .setDescription(`**${member.user ? member.user.tag : 'عضو غير معروف'}** غادر السيرفر\n**عدد الأعضاء** ${member.guild.memberCount}`)
        .setThumbnail(member.user ? member.user.displayAvatarURL() : member.displayAvatarURL())
        .setTimestamp();

      await sendLog(client, guildId, logEmbed, 'member_leave');
    } catch (err) {
      console.error('Error in guildMemberRemove event:', err);
    }
  }
};
