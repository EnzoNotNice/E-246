const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('إغلاق التذكرة الحالية')
    .addStringOption(o => o.setName('reason').setDescription('سبب الإغلاق'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const ticket = db.getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ embeds: [error(locale.get('tickets.notTicket'))], flags: ['Ephemeral'] });
    if (ticket.status === 'closed') return interaction.reply({ embeds: [error(locale.get('tickets.alreadyClosed'))], flags: ['Ephemeral'] });

    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

    await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false, SendMessages: false });
    db.updateTicketStatus(interaction.channelId, 'closed');

    const emojis = require('../../utils/emojis.json');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_delete').setLabel('حذف').setEmoji(emojis.trash || '1519212192912637962').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_reopen').setLabel('إعادة فتح').setEmoji(emojis.lock || '1519212231332593785').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('<:lock:1519212231332593785> تم إغلاق التذكرة')
      .setDescription(`أُغلقت بواسطة ${interaction.user}\n**السبب:** ${reason}`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
