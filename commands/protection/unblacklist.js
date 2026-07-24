const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('إزالة قائمة سوداء')
    .addUserOption(o => o.setName('user').setDescription('العضو للإزالة'))
    .addRoleOption(o => o.setName('role').setDescription('الرتبة للإزالة'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {  
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      if (!user && !role) return interaction.reply({ embeds: [error(locale.get('general.noTarget'))], flags: ['Ephemeral'] });
      const target = user || role;
      const result = db.removeBlacklist(interaction.guildId, target.id);
      if (!result.changes) return interaction.reply({ embeds: [error(locale.get('general.notFound'))], flags: ['Ephemeral'] });
      return interaction.reply({ embeds: [success(locale.get('protection.unblacklisted', { target: user ? `<@${target.id}>` : `<@&${target.id}>` }))] });
    
    } catch (err) {
      console.error('[Command Error - unblacklist.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
