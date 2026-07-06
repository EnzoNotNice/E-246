const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automation')
    .setDescription('إدارة إعدادات الأوتوميشن')
    .addSubcommand(s => s.setName('show').setDescription('عرض إعدادات الأوتوميشن'))
    .addSubcommand(s => s.setName('images').setDescription('إعداد صور فقط')
      .addChannelOption(o => o.setName('channel').setDescription('الروم').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('youtube').setDescription('إعداد روابط يوتيوب')
      .addChannelOption(o => o.setName('channel').setDescription('الروم').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('lineadd').setDescription('إضافة فاصل تلقائي')
      .addChannelOption(o => o.setName('channel').setDescription('الروم').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('separator').setDescription('نص الفاصل').setRequired(true)))
    .addSubcommand(s => s.setName('reactadd').setDescription('إضافة تفاعل تلقائي')
      .addChannelOption(o => o.setName('channel').setDescription('الروم').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('emoji').setDescription('الإيموجي للتفاعل').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('حذف أتمتة الروم')
      .addChannelOption(o => o.setName('channel').setDescription('الروم').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('type').setDescription('النوع للحذف').setRequired(true).addChoices(
        { name: 'Images Only', value: 'images' },
        { name: 'YouTube Only', value: 'youtube' },
        { name: 'Auto Line', value: 'line' },
        { name: 'Auto React', value: 'react' }
      )))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      const all = db.getAllAutomation(interaction.guildId);
      if (!all.length) return interaction.reply({ embeds: [error(locale.get('automation.noAutomation'))], flags: ['Ephemeral'] });

      const lines = all.map(a => {
        const types = { images: '{emoji:photo} Images Only', youtube: '{emoji:playerplay} YouTube Only', line: '{emoji:adjustments} Auto-Line', react: '{emoji:moodsmile} Auto-React' };
        return `${types[a.type] || a.type} — <#${a.channelId}>${a.value ? ` (\`${a.value}\`)` : ''}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('{emoji:settings} Automation Settings')
        .setDescription(lines.join('\n'))
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'images') {
      const ch = interaction.options.getChannel('channel');
      const existing = db.getAutomation(interaction.guildId, ch.id).find(a => a.type === 'images');
      if (existing) {
        db.removeAutomation(interaction.guildId, ch.id, 'images');
        return interaction.reply({ embeds: [success(locale.get('automation.imagesDisabled', { channel: ch }))] });
      }
      db.addAutomation(interaction.guildId, ch.id, 'images', null);
      return interaction.reply({ embeds: [success(locale.get('automation.imagesEnabled', { channel: ch }))] });
    }

    if (sub === 'youtube') {
      const ch = interaction.options.getChannel('channel');
      const existing = db.getAutomation(interaction.guildId, ch.id).find(a => a.type === 'youtube');
      if (existing) {
        db.removeAutomation(interaction.guildId, ch.id, 'youtube');
        return interaction.reply({ embeds: [success(locale.get('automation.youtubeDisabled', { channel: ch }))] });
      }
      db.addAutomation(interaction.guildId, ch.id, 'youtube', null);
      return interaction.reply({ embeds: [success(locale.get('automation.youtubeEnabled', { channel: ch }))] });
    }

    if (sub === 'lineadd') {
      const ch = interaction.options.getChannel('channel');
      const sep = interaction.options.getString('separator');
      db.addAutomation(interaction.guildId, ch.id, 'line', sep);
      return interaction.reply({ embeds: [success(locale.get('automation.autoLineAdded', { channel: ch, sep }))] });
    }

    if (sub === 'reactadd') {
      const ch = interaction.options.getChannel('channel');
      const emoji = interaction.options.getString('emoji');
      db.addAutomation(interaction.guildId, ch.id, 'react', emoji);
      return interaction.reply({ embeds: [success(locale.get('automation.autoReactAdded', { channel: ch, emoji }))] });
    }

    if (sub === 'remove') {
      const ch = interaction.options.getChannel('channel');
      const type = interaction.options.getString('type');
      db.removeAutomation(interaction.guildId, ch.id, type);
      return interaction.reply({ embeds: [success(locale.get('automation.automationRemoved', { type, channel: ch }))] });
    }
  }
};
