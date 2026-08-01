const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automation')
    .setDescription('إدارة إعدادات الأوتوميشن')
    .addSubcommand((s) => s.setName('show').setDescription('عرض إعدادات الأوتوميشن'))
    .addSubcommand((s) =>
      s
        .setName('images')
        .setDescription('إعداد صور فقط')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('الروم')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('youtube')
        .setDescription('إعداد روابط يوتيوب')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('الروم')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('lineadd')
        .setDescription('إضافة فاصل تلقائي في قنوات متعددة')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('الروم الأول')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((o) => o.setName('separator').setDescription('نص الفاصل').setRequired(true))
        .addChannelOption((o) =>
          o
            .setName('channel2')
            .setDescription('الروم الثاني (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption((o) =>
          o
            .setName('channel3')
            .setDescription('الروم الثالث (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption((o) =>
          o
            .setName('channel4')
            .setDescription('الروم الرابع (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption((o) =>
          o
            .setName('channel5')
            .setDescription('الروم الخامس (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('reactadd')
        .setDescription('إضافة تفاعل تلقائي في قنوات متعددة')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('الروم الأول')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((o) => o.setName('emoji').setDescription('الإيموجي للتفاعل').setRequired(true))
        .addChannelOption((o) =>
          o
            .setName('channel2')
            .setDescription('الروم الثاني (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption((o) =>
          o
            .setName('channel3')
            .setDescription('الروم الثالث (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption((o) =>
          o
            .setName('channel4')
            .setDescription('الروم الرابع (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addChannelOption((o) =>
          o
            .setName('channel5')
            .setDescription('الروم الخامس (اختياري)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('حذف أتمتة الروم')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('الروم')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('النوع للحذف')
            .setRequired(true)
            .addChoices(
              { name: 'Images Only', value: 'images' },
              { name: 'YouTube Only', value: 'youtube' },
              { name: 'Auto Line', value: 'line' },
              { name: 'Auto React', value: 'react' }
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      if (sub === 'show') {
        const all = db.getAllAutomation(interaction.guildId);
        if (!all.length) return interaction.editReply({ embeds: [error(locale.get('automation.noAutomation'))] });

        const lines = all.map((a) => {
          const types = {
            images: '{emoji:photo} Images Only',
            youtube: '{emoji:playerplay} YouTube Only',
            line: '{emoji:adjustments} Auto-Line',
            react: '{emoji:moodsmile} Auto-React'
          };
          return `${types[a.type] || a.type} — <#${a.channelId}>${a.value ? ` (\`${a.value}\`)` : ''}`;
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('{emoji:settings} Automation Settings')
          .setDescription(lines.join('\n'))
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === 'images') {
        const ch = interaction.options.getChannel('channel');
        const existing = db.getAutomation(interaction.guildId, ch.id).find((a) => a.type === 'images');
        if (existing) {
          db.removeAutomation(interaction.guildId, ch.id, 'images');
          return interaction.editReply({ embeds: [success(locale.get('automation.imagesDisabled', { channel: ch }))] });
        }
        db.addAutomation(interaction.guildId, ch.id, 'images', null);
        return interaction.editReply({ embeds: [success(locale.get('automation.imagesEnabled', { channel: ch }))] });
      }

      if (sub === 'youtube') {
        const ch = interaction.options.getChannel('channel');
        const existing = db.getAutomation(interaction.guildId, ch.id).find((a) => a.type === 'youtube');
        if (existing) {
          db.removeAutomation(interaction.guildId, ch.id, 'youtube');
          return interaction.editReply({
            embeds: [success(locale.get('automation.youtubeDisabled', { channel: ch }))]
          });
        }
        db.addAutomation(interaction.guildId, ch.id, 'youtube', null);
        return interaction.editReply({ embeds: [success(locale.get('automation.youtubeEnabled', { channel: ch }))] });
      }

      if (sub === 'lineadd') {
        const channels = [
          interaction.options.getChannel('channel'),
          interaction.options.getChannel('channel2'),
          interaction.options.getChannel('channel3'),
          interaction.options.getChannel('channel4'),
          interaction.options.getChannel('channel5')
        ].filter((ch) => ch !== null);

        const sep = interaction.options.getString('separator');
        for (const ch of channels) {
          db.addAutomation(interaction.guildId, ch.id, 'line', sep);
        }

        const channelMentions = channels.map((ch) => `<#${ch.id}>`).join(', ');
        return interaction.editReply({
          embeds: [success(`تم إضافة الفاصل التلقائي في القنوات: ${channelMentions}\nالفاصل: \`${sep}\``)]
        });
      }

      if (sub === 'reactadd') {
        const channels = [
          interaction.options.getChannel('channel'),
          interaction.options.getChannel('channel2'),
          interaction.options.getChannel('channel3'),
          interaction.options.getChannel('channel4'),
          interaction.options.getChannel('channel5')
        ].filter((ch) => ch !== null);

        const emoji = interaction.options.getString('emoji');
        for (const ch of channels) {
          db.addAutomation(interaction.guildId, ch.id, 'react', emoji);
        }

        const channelMentions = channels.map((ch) => `<#${ch.id}>`).join(', ');
        return interaction.editReply({
          embeds: [success(`تم إضافة التفاعل التلقائي في القنوات: ${channelMentions}\nالتفاعل: ${emoji}`)]
        });
      }

      if (sub === 'remove') {
        const ch = interaction.options.getChannel('channel');
        const type = interaction.options.getString('type');
        db.removeAutomation(interaction.guildId, ch.id, type);
        return interaction.editReply({
          embeds: [success(locale.get('automation.automationRemoved', { type, channel: ch }))]
        });
      }
    } catch (err) {
      logger.error('[Command Error - automation.js]:', err);
      if (interaction && !interaction.replied && interaction.deferred) {
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.' }).catch(() => null);
      } else if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
