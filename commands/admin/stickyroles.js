const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stickyroles')
    .setDescription('إدارة وتكوين نظام استعادة الرتب التلقائية (Sticky Roles) عند إعادة الدخول')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('تفعيل أو تعطيل ميزة استعادة الرتب التلقائية')
        .addBooleanOption((o) => o.setName('enabled').setDescription('الحالة (تفعيل / تعطيل)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('مسح الرتب المحفوظة لعضو معين حتى لا تتم استعادتها')
        .addUserOption((o) => o.setName('user').setDescription('العضو المراد مسح سجل رتبه').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignore')
        .setDescription('إضافة أو إزالة رتبة من قائمة التجاهل (لن يتم حفظها أو استعادتها)')
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة المراد استثناؤها').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('عرض إعدادات وقائمة الرتب المستثناة من الاستعادة')),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;
      const settings = db.getStickyRoleSettings(guildId);

      if (sub === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled');
        db.setStickyRoleSettings(guildId, { enabled });

        const embed = new EmbedBuilder()
          .setColor(enabled ? 0x57f287 : 0xed4245)
          .setTitle('🛡️ نظام استعادة الرتب التلقائية (Sticky Roles)')
          .setDescription(
            `تم **${enabled ? 'تفعيل' : 'تعطيل'}** استعادة الرتب التلقائية للأعضاء عند عودتهم للسيرفر بنجاح.`
          )
          .setTimestamp();

        return await interaction.reply({ embeds: [embed] });
      }

      if (sub === 'clear') {
        const targetUser = interaction.options.getUser('user');
        db.deleteStickyRoles(guildId, targetUser.id);

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('🧹 مسح سجل الرتب المحفوظة')
          .setDescription(
            `تم مسح سجل الرتب المحفوظة للعضو <@${targetUser.id}> بنجاح. لن تتم استعادة أي رتب سابقة له عند انضمامه.`
          )
          .setTimestamp();

        return await interaction.reply({ embeds: [embed] });
      }

      if (sub === 'ignore') {
        const role = interaction.options.getRole('role');
        const ignored = new Set(settings.ignoredRoles || []);

        let added = false;
        if (ignored.has(role.id)) {
          ignored.delete(role.id);
        } else {
          ignored.add(role.id);
          added = true;
        }

        db.setStickyRoleSettings(guildId, { ignoredRoles: Array.from(ignored) });

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('⚙️ تحديث قائمة الرتب المستثناة')
          .setDescription(
            added
              ? `تمت **إضافة** الرتبة <@&${role.id}> إلى قائمة التجاهل. لن يتم حفظها أو استعادتها للأعضاء المغادرين.`
              : `تمت **إزالة** الرتبة <@&${role.id}> من قائمة التجاهل. ستتم استعادتها مستقبلاً بشكل طبيعي.`
          )
          .setTimestamp();

        return await interaction.reply({ embeds: [embed] });
      }

      if (sub === 'list') {
        const ignored = settings.ignoredRoles || [];
        const ignoredMentions =
          ignored.length > 0 ? ignored.map((id) => `<@&${id}>`).join(', ') : 'لا توجد رتب مستثناة';

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🛡️ إعدادات نظام الرتب التلقائية (Sticky Roles)')
          .addFields(
            { name: 'الحالة العامة', value: settings.enabled ? '🟢 مفعّل' : '🔴 معطّل', inline: true },
            { name: 'إجمالي الرتب المستثناة', value: `\`${ignored.length}\` رتبة`, inline: true },
            { name: 'الرتب المستثناة من الاستعادة', value: ignoredMentions, inline: false }
          )
          .setFooter({ text: 'لحفظ الرتب واستعادتها يجب أن تكون رتبة البوت أعلى من الرتب المراد استعادتها' })
          .setTimestamp();

        return await interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error('[StickyRoles Command Error]:', err);
      if (interaction.deferred) {
        return interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر.' });
      }
      return interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral: true }).catch(() => null);
    }
  }
};
