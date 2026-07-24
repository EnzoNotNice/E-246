const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetdm')
    .setDescription('رسالة ترحيب الخاص')
    .addStringOption(o => o.setName('message').setDescription('رسالة الخاص'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const msg = interaction.options.getString('message') || null;
      db.getGreetSettings(interaction.guildId);
      db.db.prepare('UPDATE greet_settings SET dm_message = ? WHERE guildId = ?').run(msg, interaction.guildId);
      return interaction.reply({
        embeds: [success(msg ? locale.get('greet.dmMessageSet') : locale.get('greet.dmMessageDisabled'))]
      });
    
    } catch (err) {
      console.error('[Command Error - greetdm.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
