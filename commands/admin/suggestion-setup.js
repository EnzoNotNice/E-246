const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggestion-setup')
    .setDescription('إعداد روم الاقتراحات وروم المراجعة')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('روم عرض الاقتراحات للأعضاء')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((o) =>
      o
        .setName('review-channel')
        .setDescription('روم المراجعة للإدارة لقَبول أو رفض المقترحات')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addBooleanOption((o) =>
      o.setName('auto-thread').setDescription('إنشاء خيط (Thread) مناقشة تلقائي تحت كل اقتراح').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('channel');
      const reviewChannel = interaction.options.getChannel('review-channel');
      const autoThread = interaction.options.getBoolean('auto-thread') ?? true;

      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      db.setSuggestionSettings(interaction.guildId, {
        channelId: channel.id,
        logChannelId: reviewChannel.id,
        autoThread
      });

      return interaction.editReply({
        embeds: [
          success(
            `تم إعداد نظام الاقتراحات بنجاح\n\n- **روم الاقتراحات:** <#${channel.id}>\n- **روم المراجعة:** <#${reviewChannel.id}>\n- **خيط تلقائي:** ${autoThread ? 'مفعل' : 'معطل'}`
          )
        ]
      });
    } catch (err) {
      logger.error('[Command Error - suggestion-setup.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
