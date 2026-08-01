const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('إزالة تحذير معين أو جميع التحذيرات لعضو')
    .addUserOption((o) => o.setName('user').setDescription('العضو لإلغاء تحذيره').setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName('number')
        .setDescription('رقم التحذير المراد إزالته (مثال: 1, 2) - اتركه فارغاً لمسح الكل')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      const target = interaction.options.getMember('user');
      const number = interaction.options.getInteger('number');

      if (!target)
        return interaction.reply({ embeds: [error(locale.get('general.userNotFound'))], flags: ['Ephemeral'] });
      if (target.user.bot)
        return interaction.reply({ embeds: [error('البوتات ليس لديها تحذيرات')], flags: ['Ephemeral'] });
      if (target.id === interaction.guild.ownerId)
        return interaction.reply({ embeds: [error(locale.get('general.noPermission'))], flags: ['Ephemeral'] });
      if (
        interaction.user.id !== interaction.guild.ownerId &&
        target.roles.highest.position >= interaction.member.roles.highest.position
      )
        return interaction.reply({ embeds: [error(locale.get('general.noPermission'))], flags: ['Ephemeral'] });

      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      const warnings = db.getWarnings(target.id, interaction.guildId);
      if (!warnings.length) {
        return interaction.editReply({
          embeds: [error('لا يوجد أي تحذيرات مسجلة لهذا العضو')]
        });
      }

      if (number !== null) {
        // Remove a specific warning (1-indexed for user view)
        const index = number - 1;
        if (index < 0 || index >= warnings.length) {
          return interaction.editReply({
            embeds: [error(`رقم التحذير غير صالح يرجى اختيار رقم بين 1 و ${warnings.length}`)]
          });
        }

        const warningToRemove = warnings[index];
        const successRemove = db.removeWarning(target.id, interaction.guildId, index);
        if (!successRemove) {
          return interaction.editReply({
            embeds: [error('فشل إزالة التحذير المحدد')]
          });
        }

        // Log mod action
        db.addModAction(
          interaction.guildId,
          target.id,
          target.user.tag,
          interaction.user.id,
          interaction.user.tag,
          'unwarn',
          `إزالة التحذير رقم #${number} - السبب الأصلي: ${warningToRemove.reason}`
        );

        const logEmbed = modlog(
          'تم إلغاء تحذير محدد',
          { tag: target.user.tag, id: target.id },
          interaction.user,
          `إزالة التحذير رقم #${number}`,
          {
            '{emoji:alerttriangle} إجمالي التحذيرات المتبقية': String(warnings.length - 1)
          }
        );
        await sendLog(interaction.client, interaction.guildId, logEmbed, 'warn');

        return interaction.editReply({
          embeds: [success(`تم إزالة التحذير رقم **#${number}** للعضو **${target.user.tag}**`)]
        });
      } else {
        // Clear all warnings
        db.clearWarnings(target.id, interaction.guildId);

        // Log mod action
        db.addModAction(
          interaction.guildId,
          target.id,
          target.user.tag,
          interaction.user.id,
          interaction.user.tag,
          'unwarn',
          'مسح جميع التحذيرات'
        );

        const logEmbed = modlog(
          'تم مسح جميع تحذيرات العضو',
          { tag: target.user.tag, id: target.id },
          interaction.user,
          'مسح جميع التحذيرات',
          {
            '{emoji:alerttriangle} إجمالي التحذيرات المتبقية': '0'
          }
        );
        await sendLog(interaction.client, interaction.guildId, logEmbed, 'warn');

        return interaction.editReply({
          embeds: [success(`تم مسح جميع تحذيرات العضو **${target.user.tag}** بنجاح`)]
        });
      }
    } catch (err) {
      logger.error('[Command Error - unwarn.js]:', err);
      if (interaction && typeof interaction.editReply === 'function') {
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر' }).catch(() => null);
      }
    }
  }
};
