const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('إضافة قائمة بيضاء')
    .addUserOption(o => o.setName('user').setDescription('العضو للقائمة البيضاء'))
    .addRoleOption(o => o.setName('role').setDescription('الرتبة للقائمة البيضاء'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {  
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
  
      if (!user && !role) return interaction.reply({ embeds: [error(locale.get('general.noTarget'))], flags: ['Ephemeral'] });
  
      const target = user || role;
      const type = user ? 'user' : 'role';
      db.addWhitelist(interaction.guildId, target.id, type);
  
      return interaction.reply({ embeds: [success(locale.get('protection.whitelisted', { target: user ? `<@${target.id}>` : `<@&${target.id}>` }))] });
    
    } catch (err) {
      console.error('[Command Error - whitelist.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
