const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { createLeaderboardCanvas } = require('../../utils/canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('عرض لوحة ترتيب نقاط الخبرة في السيرفر بتصميم صورة مخصص'),

  async execute(interaction) {
    await interaction.deferReply();
    const leaderboard = db.getLeaderboard(interaction.guildId, 10);

    if (!leaderboard || leaderboard.length === 0) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('<:circlex:1519212245559672914> **لم يكسب أحد نقاط خبرة بعد**')]
      });
    }

    const requestingUserRankIndex = leaderboard.findIndex(u => u.userId === interaction.user.id);
    const requestingUserRank = requestingUserRankIndex >= 0 ? requestingUserRankIndex + 1 : null;

    const buffer = await createLeaderboardCanvas(interaction.guild, leaderboard, requestingUserRank);
    const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

    return interaction.editReply({ files: [attachment] });
  }
};
