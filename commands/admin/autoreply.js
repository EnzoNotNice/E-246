const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoreply')
    .setDescription('إدارة الردود التلقائية في السيرفر')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('إضافة رد تلقائي جديد')
        .addStringOption((o) => o.setName('trigger').setDescription('نص أو كلمة التشغيل').setRequired(true))
        .addStringOption((o) => o.setName('response').setDescription('نص الرد المطلوب إرساله').setRequired(true))
        .addBooleanOption((o) => o.setName('delete_message').setDescription('مسح رسالة العضو الأصلية بعد الرد'))
        .addStringOption((o) =>
          o
            .setName('mode')
            .setDescription('طريقة الرد')
            .addChoices(
              { name: 'رد مباشر (Reply)', value: 'reply' },
              { name: 'رسالة منفصلة (Message)', value: 'message' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('حذف رد تلقائي موجود')
        .addStringOption((o) => o.setName('trigger').setDescription('عبارة التشغيل للحذف').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('عرض جميع الردود التلقائية المفعلة في السيرفر'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (sub === 'add') {
        const trigger = interaction.options.getString('trigger').toLowerCase();
        const response = interaction.options.getString('response');
        const deleteTrigger = interaction.options.getBoolean('delete_message') ? 1 : 0;
        const mode = interaction.options.getString('mode') || 'reply';

        const existing = db.getAutoReplies(guildId).find((r) => r.trigger === trigger);
        if (existing) {
          return interaction.reply({ embeds: [error(locale.get('general.alreadyExists'))], flags: ['Ephemeral'] });
        }

        db.addAutoReply(guildId, trigger, response, deleteTrigger, mode);
        return interaction.reply({ embeds: [success(locale.get('moderation.autoReplyAdded', { trigger, response }))] });
      }

      if (sub === 'remove') {
        const trigger = interaction.options.getString('trigger').toLowerCase();
        const result = db.removeAutoReply(guildId, trigger);

        if (!result.changes) {
          return interaction.reply({ embeds: [error(locale.get('general.notFound'))], flags: ['Ephemeral'] });
        }

        return interaction.reply({ embeds: [success(locale.get('moderation.autoReplyRemoved', { trigger }))] });
      }

      if (sub === 'list') {
        const replies = db.getAutoReplies(guildId);
        if (!replies || replies.length === 0) {
          return interaction.reply({ embeds: [error('لا توجد ردود تلقائية مضافة حالياً')], flags: ['Ephemeral'] });
        }

        const lines = replies.map((r, i) => `**#${i + 1}** \`${r.trigger}\` ➔ ${r.response.slice(0, 50)}`);
        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('قائمة الردود التلقائية')
          .setDescription(lines.join('\n'))
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error('[Command Error - autoreply.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
