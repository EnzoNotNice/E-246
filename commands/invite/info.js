const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('عرض معلومات مفيدة عن تتبع دعوات عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد عرض معلوماته').setRequired(true)),

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
      .setTitle(`<:list:1519212232670580868> معلومات الدعوات - ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '<:clock:1519212244263632916> تاريخ إنشاء الحساب', value: createdAt, inline: false },
        { name: '<:clock:1519212244263632916> عمر الحساب', value: `${accountAge} يوم`, inline: true },
        { name: '<:mail:1519212229445029971> انضم للسيرفر', value: joinedAt, inline: false },
        { name: '<:circlecheck:1519212246876557413> الدعوات الصحيحة', value: String(real), inline: true },
        { name: '<:chartpie:1519212248479043634> إجمالي الدعوات', value: String(inviteData.total), inline: true },
        { name: '<:gift:1519212237317865553> الدعوات الإضافية', value: String(inviteData.bonus), inline: true },
        { name: '<:circlex:1519212245559672914> الدعوات المزيفة', value: String(inviteData.fake), inline: true },
        { name: '<:folderopen:1519212239876395138> غادروا السيرفر', value: String(inviteData.left), inline: true },
        { name: '<:trophy:1519212189171454003> الرتبة التالية', value: nextRankStr }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
