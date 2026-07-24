const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bc')
    .setDescription('رسالة جماعية للأعضاء')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {  
      const locale = require('../../utils/locale');
  
      const modal = new ModalBuilder()
        .setCustomId('bc_modal')
        .setTitle(locale.get('broadcast.modalTitle').substring(0, 45));
  
      const input = new TextInputBuilder()
        .setCustomId('bc_message')
        .setLabel(locale.get('broadcast.modalInputLabel').substring(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setPlaceholder(locale.get('broadcast.modalPlaceholder').substring(0, 100));
  
      modal.addComponents(new ActionRowBuilder().addComponents(input));
  
      await interaction.showModal(modal);
    
    } catch (err) {
      console.error('[Command Error - bc.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
