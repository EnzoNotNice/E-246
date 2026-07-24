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
    try {  
      const ticket = db.getTicketByChannel(interaction.channelId);
      if (!ticket) return interaction.reply({ embeds: [error(locale.get('tickets.notTicket'))], flags: ['Ephemeral'] });
      if (ticket.status === 'closed') return interaction.reply({ embeds: [error(locale.get('tickets.alreadyClosed'))], flags: ['Ephemeral'] });
  
      const reason = interaction.options.getString('reason') || 'لا يوجد سبب';
  
      await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false, SendMessages: false });
      db.updateTicketStatus(interaction.channelId, 'closed');
  
      const emojis = require('../../utils/emojis.json');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_delete').setLabel('حذف').setEmoji(emojis.trash || '<:trash:1525592579427795145>').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_reopen').setLabel('إعادة فتح').setEmoji(emojis.lock || '<:lock:1525592267488759909>').setStyle(ButtonStyle.Secondary),
      );
  
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('{emoji:lock} تم إغلاق التذكرة')
        .setDescription(`أُغلقت بواسطة ${interaction.user}\n**السبب:** ${reason}`)
        .setTimestamp();
  
      return interaction.reply({ embeds: [embed], components: [row] });
    
    } catch (err) {
      console.error('[Command Error - close.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
