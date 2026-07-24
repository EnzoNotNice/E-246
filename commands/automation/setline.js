const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { success, error } = require('../../utils/embeds');
const locale = require('../../utils/locale');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setline')
    .setDescription('إعداد صورة الخط')
    .addStringOption(o => o.setName('linkimg').setDescription('رابط الصورة').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const link = interaction.options.getString('linkimg');
  
      if (!link.startsWith('http')) {
        return interaction.reply({ embeds: [error('رابط غير صالح', 'يرجى تقديم رابط صورة صحيح')], flags: ['Ephemeral'] });
      }
  
      db.setGuildSetting(interaction.guildId, 'line_image', link);
  
      return interaction.reply({ embeds: [success('تم تعيين صورة الفاصل', `تم تحديث صورة الفاصل التلقائي بنجاح`)] });
    
    } catch (err) {
      console.error('[Command Error - setline.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
