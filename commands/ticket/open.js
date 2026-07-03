const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open')
    .setDescription('فتح التذكرة المغلقة الحالية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const ticket = db.getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ embeds: [error(locale.get('tickets.notTicket'))], flags: ['Ephemeral'] });
    if (ticket.status === 'open') return interaction.reply({ embeds: [error(locale.get('tickets.alreadyOpen'))], flags: ['Ephemeral'] });

    const settings = db.getTicketSettings(interaction.guildId);
    const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);

    await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true });
    if (settings.staff_role) await interaction.channel.permissionOverwrites.edit(settings.staff_role, { ViewChannel: true, SendMessages: true });

    db.updateTicketStatus(interaction.channelId, 'open');

    return interaction.reply({ embeds: [success(locale.get('tickets.reopened', { user: interaction.user }))] });
  }
};
