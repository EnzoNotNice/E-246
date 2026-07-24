const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetinvites')
    .setDescription('تصفير دعوات الأعضاء')
    .addUserOption(o => o.setName('user').setDescription('العضو لتصفير الدعوات'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const user = interaction.options.getUser('user');
  
      if (user) {
        db.resetInvites(user.id, interaction.guildId);
        return interaction.reply({ embeds: [success(locale.get('invites.userReset', { user: user.tag }))] });
      }
  
      db.resetAllInvites(interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('invites.serverReset'))] });
    
    } catch (err) {
      console.error('[Command Error - resetinvites.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
