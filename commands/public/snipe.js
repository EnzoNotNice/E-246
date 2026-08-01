const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder().setName('snipe').setDescription('آخر رسالة محذوفة'),

  async execute(interaction) {
    try {
      const data = db.getSnipe(interaction.channelId);

      if (!data) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('لا رسائل محذوفة')],
          flags: ['Ephemeral']
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: data.authorTag || 'مجهول', iconURL: data.authorAvatar || null })
        .setDescription(data.content || '*[لا يوجد محتوى]*')
        .setFooter({ text: `محذوفة من #${interaction.channel.name}` })
        .setTimestamp(data.timestamp * 1000);

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('[Command Error - snipe.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
