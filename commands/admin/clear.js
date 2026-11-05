const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('حذف رسائل الروم')
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('عدد رسائل الحذف').setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .addUserOption((o) => o.setName('user').setDescription('حذف رسائل عضو'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: ['Ephemeral'] });
      const amount = interaction.options.getInteger('amount') || 100;
      const filterUser = interaction.options.getUser('user');

      let fetchedMessages;
      try {
        fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
      } catch (err) {
        return interaction.editReply({ embeds: [error(locale.get('general.errorOccurred'))] });
      }

      let messages = fetchedMessages.filter((m) => !m.pinned);
      if (filterUser) messages = messages.filter((m) => m.author.id === filterUser.id);
      messages = [...messages.values()].slice(0, amount);

      if (messages.length === 0) {
        return interaction.editReply({ embeds: [error('لم يتم العثور على أي رسائل قابلة للحذف')] });
      }

      let deleted;
      try {
        deleted = await interaction.channel.bulkDelete(messages, true);
      } catch (e) {
        return interaction.editReply({ embeds: [error(locale.get('general.errorOccurred'))] });
      }

      return interaction.editReply({
        embeds: [success(locale.get('moderation.clearSuccess', { count: deleted.size }))]
      });
    } catch (err) {
      const logger = require('../../utils/logger');
      logger.error('[Command Error - clear.js]:', err);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [error(locale.get('general.errorOccurred'))] }).catch(() => null);
      }
      return interaction
        .reply({ embeds: [error(locale.get('general.errorOccurred'))], flags: ['Ephemeral'] })
        .catch(() => null);
    }
  }
};
