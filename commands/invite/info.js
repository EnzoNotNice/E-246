const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('عرض معلومات الدعوات')
    .addUserOption(o => o.setName('user').setDescription('عضو معلومات الدعوات').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const inviteData = db.getInvites(user.id, interaction.guildId);

    const real = inviteData.total - inviteData.fake - inviteData.left;
    const joinedAt = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'غادر السيرفر';
    const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`;
    const accountAge = Math.floor((Date.now() - user.createdTimestamp) / 86400000);

    const ranks = db.getInviteRanks(interaction.guildId);
    const nextRank = ranks.find(r => r.count > real);
    const nextRankStr = nextRank ? `**${nextRank.count - real}** دعوة إضافية للحصول على <@&${nextRank.roleId}>` : 'أعلى رتبة';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`{emoji:list} معلومات الدعوات - ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '{emoji:clock} تاريخ إنشاء الحساب', value: createdAt, inline: false },
        { name: '{emoji:clock} عمر الحساب', value: `${accountAge} يوم`, inline: true },
        { name: '{emoji:mail} انضم للسيرفر', value: joinedAt, inline: false },
        { name: '{emoji:circlecheck} الدعوات الصحيحة', value: String(real), inline: true },
        { name: '{emoji:chartpie} إجمالي الدعوات', value: String(inviteData.total), inline: true },
        { name: '{emoji:gift} الدعوات الإضافية', value: String(inviteData.bonus), inline: true },
        { name: '{emoji:circlex} الدعوات المزيفة', value: String(inviteData.fake), inline: true },
        { name: '{emoji:folderopen} غادروا السيرفر', value: String(inviteData.left), inline: true },
        { name: '{emoji:trophy} الرتبة التالية', value: nextRankStr }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
