const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { createLeaderboardCanvas } = require('../../utils/canvas');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('أعلى الأعضاء نشاطاً ولوحة الصدارة')
    .addIntegerOption((o) => o.setName('page').setDescription('رقم الصفحة للمشاهدة النصية').setMinValue(1))
    .addBooleanOption((o) => o.setName('card').setDescription('عرض كبطاقة مصممة (Canvas) بدلاً من القائمة النصية')),

  async execute(interaction) {
    try {
      const levelSettings = db.getLevelSettings(interaction.guildId);
      if (!levelSettings || !levelSettings.enabled) {
        return interaction.reply({
          content: '{emoji:circlex} **نظام المستويات معطّل في هذا السيرفر.**',
          flags: ['Ephemeral']
        });
      }

      const showCard = interaction.options.getBoolean('card');
      const pageOption = interaction.options.getInteger('page');

      // If user specifically asked for card, or didn't provide a page and card is not explicitly false
      if (showCard || (showCard !== false && !pageOption)) {
        await interaction.deferReply();
        const leaderboard = db.getLeaderboard(interaction.guildId, 10);
        if (!leaderboard || leaderboard.length === 0) {
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('لا نقاط خبرة')]
          });
        }
        const requestingUserRank = db.getUserRank(interaction.user.id, interaction.guildId);
        const buffer = await createLeaderboardCanvas(interaction.guild, leaderboard, requestingUserRank);
        const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
        return interaction.editReply({ files: [attachment] });
      }

      const page = pageOption || 1;
      const perPage = 10;
      const offset = (page - 1) * perPage;

      const leaderboard = db.getLeaderboard(interaction.guildId, 200);
      const totalPages = Math.ceil(leaderboard.length / perPage) || 1;

      if (!leaderboard || !leaderboard.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('لا نقاط خبرة')],
          flags: ['Ephemeral']
        });
      }

      const slice = leaderboard.slice(offset, offset + perPage);
      const medals = ['🥇', '🥈', '🥉'];

      const rows = slice.map((entry, i) => {
        const pos = offset + i + 1;
        const medal = medals[pos - 1] || `**#${pos}**`;
        return `${medal} <@${entry.userId}> — لفل **${entry.level}** • **${entry.xp.toLocaleString()}** XP`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`{emoji:trophy} ${interaction.guild.name} لوحة الصدارة`)
        .setDescription(rows.join('\n'))
        .setFooter({ text: `صفحة ${page} من ${totalPages}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('[Command Error - top.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.' }).catch(() => null);
        } else {
          await interaction
            .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
            .catch(() => null);
        }
      }
    }
  }
};
