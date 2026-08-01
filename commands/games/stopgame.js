const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stopgame')
    .setDescription('إيقاف اللعبة الحالية في الروم')
    .addChannelOption((o) => o.setName('channel').setDescription('روم اللعبة').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      db.deleteActiveGame(channel.id);
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('{emoji:stop} تم إيقاف اللعبة')
        .setDescription(`تم إيقاف اللعبة الحالية في <#${channel.id}> بواسطة <@${interaction.user.id}>`)
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => null);

      return interaction.reply({
        embeds: [success('تم إيقاف اللعبة بنجاح')]
      });
    } catch (err) {
      logger.error('[Command Error - stopgame.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
