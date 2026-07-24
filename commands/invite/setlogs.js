const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('سجلات دخول وخروج')
    .addChannelOption(o => o.setName('channel').setDescription('روم الدخول والخروج').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const ch = interaction.options.getChannel('channel');
      db.db.prepare('INSERT INTO invite_logs (guildId, channelId) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET channelId = ?').run(interaction.guildId, ch.id, ch.id);
      return interaction.reply({ embeds: [success(locale.get('invites.logsSet', { channel: ch }))] });
    
    } catch (err) {
      console.error('[Command Error - setlogs.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
