const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('حذف رسائل الروم')
    .addIntegerOption(o => o.setName('amount').setDescription('عدد رسائل الحذف').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('حذف رسائل عضو'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ flags: ['Ephemeral'] });
    const amount = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');

    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    messages = messages.filter(m => !m.pinned);
    if (filterUser) messages = messages.filter(m => m.author.id === filterUser.id);
    messages = [...messages.values()].slice(0, amount);

    let deleted;
    try {
      deleted = await interaction.channel.bulkDelete(messages, true);
    } catch (e) {
      return interaction.editReply({ embeds: [error(locale.get('general.errorOccurred'))] });
    }

    return interaction.editReply({
      embeds: [success(locale.get('moderation.clearSuccess', { count: deleted.size }))]
    });
  }
};
