const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeautoreply')
    .setDescription('حذف رد تلقائي')
    .addStringOption(o => o.setName('trigger').setDescription('عبارة التشغيل للحذف').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {  
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const result = db.removeAutoReply(interaction.guildId, trigger);
  
      if (!result.changes) return interaction.reply({ embeds: [error(locale.get('general.notFound'))], flags: ['Ephemeral'] });
  
      return interaction.reply({ embeds: [success(locale.get('moderation.autoReplyRemoved', { trigger }))] });
    
    } catch (err) {
      console.error('[Command Error - removeautoreply.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
