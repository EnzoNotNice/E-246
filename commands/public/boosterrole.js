const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

// Role name blacklist to prevent impersonation or unauthorized staff titles
const FORBIDDEN_NAMES = [
  'admin',
  'administrator',
  'mod',
  'moderator',
  'owner',
  'staff',
  'support',
  'helper',
  'everyone',
  'here',
  'bot',
  'developer',
  'security',
  'system',
  'discord',
  'official',
  'ادارة',
  'إدارة',
  'مشرف',
  'اونر',
  'مساعد',
  'دعم',
  'بوت',
  'رسمي',
  'نظام'
];

function isForbiddenName(name) {
  if (!name || typeof name !== 'string') return true;
  const lower = name.toLowerCase().replace(/[\s_\-.]+/g, '');
  return FORBIDDEN_NAMES.some((bad) => lower.includes(bad.toLowerCase()));
}

function isValidHexColor(color) {
  if (!color) return true;
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
}

function formatHexColor(color) {
  if (!color) return '#ff73fa';
  const c = color.trim();
  return c.startsWith('#') ? c : `#${c}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boosterrole')
    .setDescription('نظام رتب البوستر المخصصة')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('إنشاء رتبتك المخصصة كمعزز للسيرفر')
        .addStringOption((o) => o.setName('name').setDescription('اسم الرتبة').setRequired(true).setMaxLength(32))
        .addStringOption((o) =>
          o.setName('color').setDescription('لون الرتبة (رمز سداسي عشري مثل #FF73FA)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('تعديل اسم أو لون أو أيقونة رتبتك المخصصة')
        .addStringOption((o) =>
          o.setName('name').setDescription('الاسم الجديد للرتبة').setRequired(false).setMaxLength(32)
        )
        .addStringOption((o) => o.setName('color').setDescription('اللون الجديد (رمز سداسي عشري)').setRequired(false))
        .addAttachmentOption((o) =>
          o.setName('icon').setDescription('أيقونة الرتبة (إذا كان السيرفر يدعم ذلك)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('share')
        .setDescription('مشاركة رتبتك المخصصة مع صديق')
        .addUserOption((o) => o.setName('friend').setDescription('الصديق المراد إعطاؤه الرتبة').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('unshare')
        .setDescription('إلغاء مشاركة رتبتك المخصصة من صديق')
        .addUserOption((o) => o.setName('friend').setDescription('الصديق المراد سحب الرتبة منه').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('info').setDescription('عرض تفاصيل رتبتك المخصصة'))
    .addSubcommand((sub) => sub.setName('delete').setDescription('حذف رتبتك المخصصة'))
    .addSubcommand((sub) =>
      sub
        .setName('anchor')
        .setDescription('تحديد رتبة التثبيت (Anchor Role) لضمان وضع رتب البوستر تحت رتب الإدارة')
        .addRoleOption((o) =>
          o.setName('role').setDescription('الرتبة المرجعية التي سيتم وضع رتب البوستر أسفلها').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('cleanup').setDescription('تنظيف وفحص الرتب المتروكة للأعضاء الذين غادروا أو ألغوا البوست')
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('عرض جميع رتب البوستر النشطة في السيرفر')),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const guild = interaction.guild;
      const member = interaction.member;
      const userId = interaction.user.id;
      const guildId = guild.id;

      // ──────────────── ADMIN SUBCOMMANDS: ANCHOR, CLEANUP, LIST ────────────────
      if (['anchor', 'cleanup', 'list'].includes(sub)) {
        if (
          !member.permissions.has(PermissionFlagsBits.ManageRoles) &&
          !member.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          return interaction.reply({ content: '❌ ليس لديك صلاحية إدارة الرتب لاستخدام هذا الأمر.', ephemeral: true });
        }

        if (sub === 'anchor') {
          const anchorRole = interaction.options.getRole('role');
          db.setBoostSettings(guildId, undefined, undefined, undefined, anchorRole.id);
          const embed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('⚓ تم تعيين رتبة التثبيت (Anchor Role) بنجاح')
            .setDescription(
              `تم تحديد الرتبة المرجعية: <@&${anchorRole.id}>\n\n` +
                `سيتم تلقائياً وضع جميع رتب البوستر المخصصة الجديدة أسفل هذه الرتبة مباشرةً لضمان عدم تجاوز صلاحيات الإدارة.`
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'cleanup') {
          await interaction.deferReply();
          const roles = db.getAllBoosterRoles(guildId);
          let cleanedCount = 0;
          for (const roleData of roles) {
            let shouldRemove = false;
            let targetMember = null;
            try {
              targetMember = await guild.members.fetch(roleData.userId).catch(() => null);
            } catch {
              targetMember = null;
            }
            if (!targetMember || !targetMember.premiumSince) {
              shouldRemove = true;
            }
            if (shouldRemove) {
              const role =
                guild.roles.cache.get(roleData.roleId) || (await guild.roles.fetch(roleData.roleId).catch(() => null));
              if (role) {
                await role.delete('Booster custom role cleanup (member left or unboosted)').catch(() => null);
              }
              db.deleteBoosterRole(guildId, roleData.userId);
              cleanedCount++;
            }
          }
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🧹 نتائج تنظيف رتب البوستر المتروكة')
            .setDescription(
              `اكتمل الفحص بنجاح:\n\n` +
                `• إجمالي الرتب المفحوصة: \`${roles.length}\`\n` +
                `• الرتب المتروكة التي تم حذفها: \`${cleanedCount}\``
            )
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'list') {
          const roles = db.getAllBoosterRoles(guildId);
          if (roles.length === 0) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x5865f2)
                  .setTitle('💎 رتب البوستر المخصصة')
                  .setDescription('لا توجد أي رتب بوستر مخصصة نشطة في هذا السيرفر حالياً.')
              ]
            });
          }
          const fields = roles.slice(0, 25).map((r, idx) => {
            const sharedCount = (r.sharedWith || []).length;
            return {
              name: `${idx + 1}. ${r.roleName || 'رتبة مخصصة'}`,
              value: `• الرتبة: <@&${r.roleId}>\n• المالك: <@${r.userId}>\n• اللون: \`${r.color || '#ff73fa'}\`\n• المشتركون: \`${sharedCount}\` أصدقاء`,
              inline: true
            };
          });
          const embed = new EmbedBuilder()
            .setColor(0xff73fa)
            .setTitle(`💎 رتب البوستر المخصصة (${roles.length})`)
            .setDescription(`قائمة رتب البوستر المخصصة والنشطة في السيرفر:`)
            .addFields(fields)
            .setTimestamp();
          return interaction.reply({ embeds: [embed] });
        }
      }

      // Ensure caller is a server booster (member.premiumSince)
      const isBooster = Boolean(member?.premiumSince);
      if (!isBooster) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('💎 ميزة خاصة بمعززي السيرفر')
              .setDescription('عذراً! هذا النظام متاح فقط للأعضاء الذين قاموا بعمل **Server Boost** لهذا السيرفر.')
          ],
          ephemeral: true
        });
      }

      // Check Bot permissions
      if (!guild.members.me.permissions.has('ManageRoles')) {
        return interaction.reply({
          content: '❌ لا أملك صلاحية إدارة الرتب (`Manage Roles`) لإنشاء أو تعديل الرتب المخصصة.',
          ephemeral: true
        });
      }

      const existingRoleData = db.getBoosterRole(guildId, userId);

      // ──────────────── SUBCOMMAND: CREATE ────────────────
      if (sub === 'create') {
        if (existingRoleData) {
          return interaction.reply({
            content: `❌ لديك رتبة مخصصة بالفعل (<@&${existingRoleData.roleId}>). استخدم الأمر \`/boosterrole edit\` لتعديلها.`,
            ephemeral: true
          });
        }

        const roleName = interaction.options.getString('name').trim();
        const rawColor = interaction.options.getString('color');

        if (isForbiddenName(roleName)) {
          return interaction.reply({
            content: '❌ لا يمكنك استخدام هذه التسمية للرتبة لمخالفتها لقوانين الحماية ومنع انتحال صفة الإدارة.',
            ephemeral: true
          });
        }

        if (rawColor && !isValidHexColor(rawColor)) {
          return interaction.reply({
            content: '❌ صيغة اللون غير صالحة. يرجى استخدام رمز هيكس صحيح مثل `#FF73FA` أو `FF73FA`.',
            ephemeral: true
          });
        }

        const hexColor = formatHexColor(rawColor);

        await interaction.deferReply();

        // Create the role in Discord
        const newRole = await guild.roles.create({
          name: roleName,
          color: hexColor,
          reason: `Booster custom role for ${interaction.user.tag} (${userId})`
        });

        // Anchor role positioning: safe placement below staff
        const boostSettings = db.getBoostSettings(guildId);
        if (boostSettings?.anchorRoleId) {
          const anchorRole =
            guild.roles.cache.get(boostSettings.anchorRoleId) ||
            (await guild.roles.fetch(boostSettings.anchorRoleId).catch(() => null));
          if (anchorRole && anchorRole.position > 1) {
            const botHighest = guild.members.me.roles.highest.position;
            const targetPos = Math.min(anchorRole.position - 1, botHighest - 1);
            if (targetPos > 0) {
              await newRole
                .setPosition(targetPos)
                .catch((e) => logger.warn('[BoosterRole] Could not set role position below anchor:', e.message));
            }
          }
        }

        // Assign to booster
        await member.roles
          .add(newRole)
          .catch((e) => logger.error('[BoosterRole] Failed to assign role to creator:', e));

        // Store in DB
        db.setBoosterRole(guildId, userId, {
          roleId: newRole.id,
          roleName: newRole.name,
          color: hexColor,
          icon: null,
          sharedWith: []
        });

        const embed = new EmbedBuilder()
          .setColor(newRole.color || 0xff73fa)
          .setTitle('✨ تم إنشاء رتبتك المخصصة بنجاح!')
          .setDescription(
            `مبروك! تم إنشاء رتبتك الخاصة وإضافتها إلى حسابك.\n\n` +
              `• **اسم الرتبة:** <@&${newRole.id}>\n` +
              `• **اللون:** \`${hexColor}\`\n` +
              `• **مشاركة الرتبة:** يمكنك مشاركتها مع أصدقائك عبر \`/boosterrole share @friend\``
          )
          .setFooter({ text: 'E-246 Booster Role System' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ──────────────── SUBCOMMAND: EDIT ────────────────
      if (sub === 'edit') {
        if (!existingRoleData) {
          return interaction.reply({
            content: '❌ ليس لديك رتبة مخصصة حتى الآن. أنشئ رتبة أولاً عبر `/boosterrole create`.',
            ephemeral: true
          });
        }

        const role =
          guild.roles.cache.get(existingRoleData.roleId) ||
          (await guild.roles.fetch(existingRoleData.roleId).catch(() => null));

        if (!role) {
          db.deleteBoosterRole(guildId, userId);
          return interaction.reply({
            content:
              '❌ لم يتم العثور على الرتبة في السيرفر (ربما تم حذفها). تم تحديث السجل ويمكنك إنشاء رتبة جديدة الآن.',
            ephemeral: true
          });
        }

        const newName = interaction.options.getString('name')?.trim();
        const rawColor = interaction.options.getString('color');
        const iconAttachment = interaction.options.getAttachment('icon');

        if (!newName && !rawColor && !iconAttachment) {
          return interaction.reply({
            content: '❌ يرجى تحديد اسم أو لون أو أيقونة لتعديل الرتبة.',
            ephemeral: true
          });
        }

        if (newName && isForbiddenName(newName)) {
          return interaction.reply({
            content: '❌ لا يمكنك استخدام هذه التسمية لمخالفتها لقوانين الحماية.',
            ephemeral: true
          });
        }

        if (rawColor && !isValidHexColor(rawColor)) {
          return interaction.reply({
            content: '❌ صيغة اللون غير صالحة. يرجى استخدام رمز هيكس صحيح مثل `#FF73FA`.',
            ephemeral: true
          });
        }

        await interaction.deferReply();

        const editPayload = {};
        if (newName) editPayload.name = newName;
        if (rawColor) editPayload.color = formatHexColor(rawColor);

        if (iconAttachment) {
          // Guild must have role icon feature (usually Tier 2)
          if (guild.features.includes('ROLE_ICONS')) {
            editPayload.icon = iconAttachment.url;
          }
        }

        await role.edit(editPayload).catch((err) => {
          logger.error('[BoosterRole Edit Error]', err);
          throw err;
        });

        // Update database
        existingRoleData.roleName = role.name;
        existingRoleData.color = rawColor ? formatHexColor(rawColor) : existingRoleData.color;
        if (iconAttachment) existingRoleData.icon = iconAttachment.url;
        db.setBoosterRole(guildId, userId, existingRoleData);

        const embed = new EmbedBuilder()
          .setColor(role.color || 0xff73fa)
          .setTitle('🎨 تم تحديث رتبتك المخصصة بنجاح!')
          .setDescription(
            `تم تطبيق التعديلات على رتبتك <@&${role.id}>.\n\n` +
              `• **الاسم الحالي:** ${role.name}\n` +
              `• **اللون الحالي:** \`${existingRoleData.color}\``
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ──────────────── SUBCOMMAND: SHARE ────────────────
      if (sub === 'share') {
        if (!existingRoleData) {
          return interaction.reply({
            content: '❌ ليس لديك رتبة مخصصة لمشاركتها. أنشئ رتبة أولاً عبر `/boosterrole create`.',
            ephemeral: true
          });
        }

        const friend = interaction.options.getUser('friend');
        if (friend.id === userId) {
          return interaction.reply({ content: '❌ أنت تمتلك الرتبة بالفعل!', ephemeral: true });
        }
        if (friend.bot) {
          return interaction.reply({ content: '❌ لا يمكن إعطاء رتبة البوستر للبوتات.', ephemeral: true });
        }

        const sharedList = existingRoleData.sharedWith || [];
        if (sharedList.length >= 5) {
          return interaction.reply({
            content: '❌ لقد بلغت الحد الأقصى لمشاركة الرتبة (5 أصدقاء). قم بإلغاء مشاركتها مع أحدهم أولاً.',
            ephemeral: true
          });
        }

        if (sharedList.includes(friend.id)) {
          return interaction.reply({
            content: `❌ لقد قمت بمشاركة الرتبة مع <@${friend.id}> مسبقاً!`,
            ephemeral: true
          });
        }

        const friendMember = await guild.members.fetch(friend.id).catch(() => null);
        if (!friendMember) {
          return interaction.reply({ content: '❌ لم يتم العثور على الصديق في هذا السيرفر.', ephemeral: true });
        }

        const role =
          guild.roles.cache.get(existingRoleData.roleId) ||
          (await guild.roles.fetch(existingRoleData.roleId).catch(() => null));

        if (!role) {
          return interaction.reply({ content: '❌ لم يتم العثور على رتبتك في السيرفر.', ephemeral: true });
        }

        await friendMember.roles.add(role).catch((err) => {
          logger.error('[BoosterRole Share Error]', err);
          throw err;
        });

        db.addBoosterRoleShare(guildId, userId, friend.id);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('🤝 تمت مشاركة الرتبة بنجاح')
              .setDescription(
                `تم إعطاء رتبتك المخصصة <@&${role.id}> للصديق <@${friend.id}> بنجاح!\n` +
                  `عدد الأصدقاء المشتركين: \`${sharedList.length + 1} / 5\``
              )
          ]
        });
      }

      // ──────────────── SUBCOMMAND: UNSHARE ────────────────
      if (sub === 'unshare') {
        if (!existingRoleData) {
          return interaction.reply({
            content: '❌ ليس لديك رتبة مخصصة.',
            ephemeral: true
          });
        }

        const friend = interaction.options.getUser('friend');
        const sharedList = existingRoleData.sharedWith || [];

        if (!sharedList.includes(friend.id)) {
          return interaction.reply({
            content: `❌ لم تقم بمشاركة رتبتك مع <@${friend.id}>.`,
            ephemeral: true
          });
        }

        const friendMember = await guild.members.fetch(friend.id).catch(() => null);
        if (friendMember) {
          await friendMember.roles.remove(existingRoleData.roleId).catch(() => null);
        }

        db.removeBoosterRoleShare(guildId, userId, friend.id);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('🚫 تم إلغاء مشاركة الرتبة')
              .setDescription(`تم سحب رتبتك المخصصة <@&${existingRoleData.roleId}> من <@${friend.id}> بنجاح.`)
          ]
        });
      }

      // ──────────────── SUBCOMMAND: INFO ────────────────
      if (sub === 'info') {
        if (!existingRoleData) {
          return interaction.reply({
            content: '❌ ليس لديك رتبة مخصصة حتى الآن. أنشئ رتبة أولاً عبر `/boosterrole create`.',
            ephemeral: true
          });
        }

        const role = guild.roles.cache.get(existingRoleData.roleId);
        const shared = existingRoleData.sharedWith || [];
        const sharedMentions = shared.length > 0 ? shared.map((id) => `<@${id}>`).join(', ') : 'لا يوجد أصدقاء حالياً';

        const embed = new EmbedBuilder()
          .setColor(role?.color || 0xff73fa)
          .setTitle('💎 معلومات رتبة البوستر المخصصة')
          .addFields(
            {
              name: 'الرتبة',
              value: role ? `<@&${role.id}>` : `\`${existingRoleData.roleName}\` (غير موجودة)`,
              inline: true
            },
            { name: 'اللون', value: `\`${existingRoleData.color || '#ff73fa'}\``, inline: true },
            { name: 'صاحب الرتبة', value: `<@${userId}>`, inline: true },
            { name: `الأصدقاء المشاركون (${shared.length}/5)`, value: sharedMentions, inline: false }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ──────────────── SUBCOMMAND: DELETE ────────────────
      if (sub === 'delete') {
        if (!existingRoleData) {
          return interaction.reply({
            content: '❌ ليس لديك رتبة مخصصة لحذفها.',
            ephemeral: true
          });
        }

        await interaction.deferReply();
        const role =
          guild.roles.cache.get(existingRoleData.roleId) ||
          (await guild.roles.fetch(existingRoleData.roleId).catch(() => null));

        if (role) {
          await role.delete('Booster deleted their custom role').catch(() => null);
        }

        db.deleteBoosterRole(guildId, userId);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('🗑️ تم حذف الرتبة المخصصة')
              .setDescription('تم حذف رتبتك المخصصة بنجاح وإلغاؤها من كافة الحسابات المشتركة.')
          ]
        });
      }
    } catch (err) {
      logger.error('[BoosterRole Command Error]:', err);
      if (interaction.deferred) {
        return interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء معالجة الأمر.' });
      }
      return interaction
        .reply({ content: '❌ حدث خطأ غير متوقع أثناء معالجة الأمر.', ephemeral: true })
        .catch(() => null);
    }
  }
};
