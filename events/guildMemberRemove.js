const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const guildId = member.guild.id;
    const client = member.client;

    db.incrementDailyLeaves(guildId);

    try {
      const allInvites = db.db.prepare('SELECT * FROM invites WHERE guildId = ?').all(guildId);
    } catch (e) {}

    try {
      const inviteLogs = db.getInviteLogs(guildId);
      if (inviteLogs?.channelId) {
        const logCh = await client.channels.fetch(inviteLogs.channelId).catch(() => null);
        if (logCh) {
          const leaveEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('<:mail:1519212229445029971> مغادرة عضو')
            .setThumbnail(member.user ? member.user.displayAvatarURL() : member.displayAvatarURL())
            .setDescription(`${member.user ? member.user.tag : 'عضو غير معروف'} غادر السيرفر\n**عدد الأعضاء** ${member.guild.memberCount}`)
            .setTimestamp();
          logCh.send({ embeds: [leaveEmbed] }).catch(() => null);
        }
      }
    } catch (e) {}

    const logEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('<:mail:1519212229445029971> مغادرة عضو')
      .setDescription(`**${member.user ? member.user.tag : 'عضو غير معروف'}** غادر السيرفر\n**عدد الأعضاء** ${member.guild.memberCount}`)
      .setThumbnail(member.user ? member.user.displayAvatarURL() : member.displayAvatarURL())
      .setTimestamp();

    await sendLog(client, guildId, logEmbed, 'member_leave');
  }
};
