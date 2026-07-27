const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('feelings-setup')
    .setDescription('إعداد روم المشاعر')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('تحديد روم المشاعر')
      .addChannelOption(o => o.setName('channel').setDescription('روم المشاعر').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addBooleanOption(o => o.setName('anonymous').setDescription('إخفاء هوية صاحب الرسالة'))
    )
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('تعطيل روم المشاعر')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        const anonymous = interaction.options.getBoolean('anonymous') || false;

        db.setFeelingsSettings(guildId, channel.id, anonymous);

        return interaction.reply({
          embeds: [success(`تم إعداد روم المشاعر بنجاح\n\n**الروم** <#${channel.id}>\n**الوضع المجهول** ${anonymous ? 'مفعّل' : 'معطل'}`)]
        });
      }

      if (sub === 'disable') {
        db.setFeelingsSettings(guildId, null, false);
        return interaction.reply({
          embeds: [success('تم تعطيل روم المشاعر بنجاح')]
        });
      }
    
    } catch (err) {
      console.error('[Command Error - feelings-setup.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
  }
};
