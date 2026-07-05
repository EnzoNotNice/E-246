const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('حذف التذكرة الحالية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const ticket = db.getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ embeds: [error(locale.get('tickets.notTicket'))], flags: ['Ephemeral'] });

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('{emoji:trash} جارٍ حذف التذكرة')
      .setDescription(`ستُحذف هذه التذكرة خلال **5 ثوانٍ** بواسطة ${interaction.user}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    setTimeout(async () => {
      await interaction.channel.delete(`Ticket deleted by ${interaction.user.tag}`).catch(() => null);
    }, 5000);
  }
};
