const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('theme')
    .setDescription('تغيير لون إمبدات البوت الموحد للسيرفر')
    .addStringOption((o) => o.setName('color').setDescription('كود اللون بصيغة Hex (مثال: #5865F2)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      let colorInput = interaction.options.getString('color').trim();
      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      // Validate Hex Color
      if (!colorInput.startsWith('#')) {
        colorInput = '#' + colorInput;
      }

      const hexRegex = /^#[0-9A-F]{6}$/i;
      if (!hexRegex.test(colorInput)) {
        return interaction.editReply({
          embeds: [error('الرجاء كتابة كود لون Hex صالح مكون من 6 خانات (مثال: #FF5733 أو 5865F2)')]
        });
      }

      // Convert hex to decimal/integer
      const hexColor = colorInput.replace('#', '');
      const colorInt = parseInt(hexColor, 16);

      db.setGuildSetting(interaction.guildId, 'embed_color', colorInt);

      return interaction.editReply({
        embeds: [success(`تم تغيير لون الإمبد الموحد للسيرفر بنجاح إلى **${colorInput}**`)]
      });
    } catch (err) {
      logger.error('[Command Error - theme.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
