const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoline')
    .setDescription('إعداد الخط التلقائي')
    .addChannelOption(o => o.setName('channel').setDescription('الروم للإعداد').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const channel = interaction.options.getChannel('channel');
  
      const existing = db.getAutomation(interaction.guildId, channel.id).find(a => a.type === 'autoline');
  
      if (existing) {
        db.removeAutomation(interaction.guildId, channel.id, 'autoline');
        return interaction.reply({ embeds: [success('تعطيل الفاصل التلقائي', `تم تعطيل الفاصل التلقائي في ${channel}`)] });
      } else {
        db.addAutomation(interaction.guildId, channel.id, 'autoline', 'enabled');
        return interaction.reply({ embeds: [success('تفعيل الفاصل التلقائي', `تم تفعيل الفاصل التلقائي في ${channel}`)] });
      }
    
    } catch (err) {
      console.error('[Command Error - autoline.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
