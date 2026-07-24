const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoreply')
    .setDescription('إضافة رد تلقائي')
    .addStringOption(o => o.setName('trigger').setDescription('نص التشغيل').setRequired(true))
    .addStringOption(o => o.setName('response').setDescription('نص الرد').setRequired(true))
    .addBooleanOption(o => o.setName('delete_message').setDescription('مسح رسالة العضو بعد الرد'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {  
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const response = interaction.options.getString('response');
      const deleteTrigger = interaction.options.getBoolean('delete_message') ? 1 : 0;
  
      const existing = db.getAutoReplies(interaction.guildId).find(r => r.trigger === trigger);
      if (existing) return interaction.reply({ embeds: [error(locale.get('general.alreadyExists'))], flags: ['Ephemeral'] });
  
      db.addAutoReply(interaction.guildId, trigger, response, deleteTrigger);
      return interaction.reply({ embeds: [success(locale.get('moderation.autoReplyAdded', { trigger, response }))] });
    
    } catch (err) {
      console.error('[Command Error - autoreply.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
