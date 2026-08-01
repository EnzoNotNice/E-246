const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('إعداد روم الستاربورد (أفضل الرسائل)')
    .addChannelOption((o) =>
      o.setName('channel').setDescription('روم الستاربورد').addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName('threshold').setDescription('عدد التفاعلات المطلوبة لنقل الرسالة').setRequired(false)
    )
    .addStringOption((o) =>
      o.setName('emoji').setDescription('الإيموجي المطلوب للتفاعل (الافتراضي ⭐)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('channel');
      const threshold = interaction.options.getInteger('threshold') || 3;
      const emoji = interaction.options.getString('emoji') || '⭐';

      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      if (threshold < 1) {
        return interaction.editReply({ embeds: [error('عدد التفاعلات المطلوبة يجب أن يكون 1 على الأقل')] });
      }

      db.setStarboardSettings(interaction.guildId, {
        channelId: channel.id,
        threshold,
        emoji
      });

      return interaction.editReply({
        embeds: [
          success(
            `تم إعداد الستاربورد بنجاح\n\n- **روم الستاربورد:** <#${channel.id}>\n- **الحد الأدنى:** ${threshold} تفاعلات\n- **الإيموجي:** ${emoji}`
          )
        ]
      });
    } catch (err) {
      logger.error('[Command Error - starboard.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
