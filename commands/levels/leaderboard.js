const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { createLeaderboardCanvas } = require('../../utils/canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('لوحة ترتيب الخبرة'),

  async execute(interaction) {
    try {  
      await interaction.deferReply();
      const leaderboard = db.getLeaderboard(interaction.guildId, 10);
  
      if (!leaderboard || leaderboard.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('لا نقاط خبرة')]
        });
      }
  
      const requestingUserRank = db.getUserRank(interaction.user.id, interaction.guildId);
  
      const buffer = await createLeaderboardCanvas(interaction.guild, leaderboard, requestingUserRank);
      const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
  
      return interaction.editReply({ files: [attachment] });
    
    } catch (err) {
      console.error('[Command Error - leaderboard.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
