const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetmsg')
    .setDescription('تحديد رسالة الترحيب')
    .addStringOption(o => o.setName('message').setDescription('نص رسالة الترحيب').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const msg = interaction.options.getString('message');
      db.getGreetSettings(interaction.guildId);
      db.db.prepare('UPDATE greet_settings SET message = ? WHERE guildId = ?').run(msg, interaction.guildId);
      return interaction.reply({
        embeds: [success(locale.get('greet.messageSet'))]
      });
    
    } catch (err) {
      console.error('[Command Error - greetmsg.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
