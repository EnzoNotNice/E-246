const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('عرض أعلى الأعضاء نشاطاً في السيرفر')
    .addIntegerOption(o => o.setName('page').setDescription('رقم الصفحة').setMinValue(1)),

  async execute(interaction) {
    const page = interaction.options.getInteger('page') || 1;
    const perPage = 10;
    const offset = (page - 1) * perPage;

    const leaderboard = db.getLeaderboard(interaction.guildId, 200);
    const totalPages = Math.ceil(leaderboard.length / perPage);

    if (!leaderboard.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('<:circlex:1519212245559672914> لا يوجد أعضاء لديهم نقاط خبرة بعد')],
        flags: ['Ephemeral']
      });
    }

    const slice = leaderboard.slice(offset, offset + perPage);
    const medals = ['🥇', '🥈', '🥉'];

    const rows = await Promise.all(slice.map(async (entry, i) => {
      const pos = offset + i + 1;
      const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
      const name = user ? user.tag : `غير معروف (${entry.userId})`;
      const medal = medals[pos - 1] || `**#${pos}**`;
      return `${medal} ${name} — لفل **${entry.level}** • **${entry.xp.toLocaleString()}** XP`;
    }));

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`<:trophy:1519212189171454003> ${interaction.guild.name} لوحة الصدارة`)
      .setDescription(rows.join('\n'))
      .setFooter({ text: `صفحة ${page} من ${totalPages}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
