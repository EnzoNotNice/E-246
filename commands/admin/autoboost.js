const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoboost')
    .setDescription('إعداد رسالة الشكر للبوست')
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('تفعيل رسالة البوست')
        .addChannelOption(o => o.setName('channel').setDescription('روم البوست').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('رسالة الشكر').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('تعطيل رسالة البوست')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;
  
      if (sub === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
  
        db.setGuildSetting(guildId, 'autoboost_channel', channel.id);
        db.setGuildSetting(guildId, 'autoboost_message', message);
  
        return interaction.reply({
          embeds: [success(`تم تفعيل رسالة البوست التلقائية بنجاح\n\n**الروم** <#${channel.id}>\n**الرسالة**\n${message}`)]
        });
      }
  
      if (sub === 'disable') {
        db.setGuildSetting(guildId, 'autoboost_channel', null);
        db.setGuildSetting(guildId, 'autoboost_message', null);
  
        return interaction.reply({
          embeds: [success('تم تعطيل رسالة البوست التلقائية بنجاح')]
        });
      }
    
    } catch (err) {
      console.error('[Command Error - autoboost.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
