const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gemoji')
    .setDescription('إيموجي القيف اواي')
    .addStringOption((o) => o.setName('emoji').setDescription('إيموجي القيف اواي').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const emoji = interaction.options.getString('emoji');
      db.setGuildSetting(interaction.guildId, 'giveaway_emoji', emoji);
      return interaction.reply({ embeds: [success(locale.get('giveaway.emojiSet', { emoji }))] });
    } catch (err) {
      logger.error('[Command Error - gemoji.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
