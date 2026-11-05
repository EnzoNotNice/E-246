const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const logger = require('../utils/logger');
const { sendLog } = logger;

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    try {
      if (!oldMember || !newMember || !oldMember.guild) return;
      const guild = oldMember.guild;

      if (oldMember.nickname !== newMember.nickname) {
        const embed = new EmbedBuilder()
          .setAuthor({ name: newMember.user?.tag || 'User', iconURL: newMember.user?.displayAvatarURL() })
          .setTitle('{emoji:user} تغيير اللقب (Nickname)')
          .addFields(
            { name: 'العضو', value: `<@${newMember.id}>`, inline: false },
            { name: 'اللقب القديم', value: oldMember.nickname || 'بدون لقب', inline: true },
            { name: 'اللقب الجديد', value: newMember.nickname || 'بدون لقب', inline: true }
          )
          .setColor(0x00bfff)
          .setTimestamp()
          .setFooter({ text: `ID: ${newMember.id}` });
        await sendLog(guild.client, guild.id, embed, 'nick_change');
      }

      // Booster unboost detection: member stopped boosting
      if (oldMember.premiumSince && !newMember.premiumSince) {
        const db = require('../database/db');
        const boosterRoleData = db.getBoosterRole(guild.id, newMember.id);
        if (boosterRoleData) {
          try {
            const role =
              guild.roles.cache.get(boosterRoleData.roleId) ||
              (await guild.roles.fetch(boosterRoleData.roleId).catch(() => null));
            if (role) {
              await role.delete('User unboosted server - auto cleaning custom role').catch(() => null);
            }
          } catch (e) {
            // Role may already be deleted
          }

          db.deleteBoosterRole(guild.id, newMember.id);

          const embed = new EmbedBuilder()
            .setTitle('{emoji:trash} تنظيف رتبة البوستر التلقائي')
            .setColor(0xed4245)
            .setDescription(
              `تم حذف رتبة البوستر المخصصة للعضو <@${newMember.id}> تلقائياً لانتهاء أو إلغاء اشتراك البوست.`
            )
            .setTimestamp();
          await sendLog(guild.client, guild.id, embed, 'protection').catch(() => null);

          await newMember
            .send({
              content: `تم حذف رتبتك المخصصة في سيرفر **${guild.name}** بسبب انتهاء أو إلغاء تعزيز السيرفر (Server Boost).`
            })
            .catch(() => null);
        }
      }

      const oldRoles = oldMember.roles?.cache;
      const newRoles = newMember.roles?.cache;

      if (oldRoles && newRoles && oldRoles.size !== newRoles.size) {
        const addedRoles = newRoles.filter((r) => !oldRoles.has(r.id));
        const removedRoles = oldRoles.filter((r) => !newRoles.has(r.id));

        if (addedRoles.size > 0) {
          const hasAdmin = addedRoles.some((r) => r.permissions.has(PermissionFlagsBits.Administrator));
          if (hasAdmin) {
            const db = require('../database/db');
            const auditLogs = await guild
              .fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 })
              .catch(() => null);
            const entry = auditLogs ? auditLogs.entries.first() : null;
            if (entry && entry.targetId === newMember.id && entry.executor) {
              const executor = entry.executor;
              if (
                executor.id !== guild.ownerId &&
                !db.isWhitelisted(guild.id, executor.id) &&
                executor.id !== guild.client?.user?.id
              ) {
                await newMember.roles
                  .remove(addedRoles.filter((r) => r.permissions.has(PermissionFlagsBits.Administrator)))
                  .catch(() => null);
                const executorMember = await guild.members.fetch(executor.id).catch(() => null);
                if (executorMember) {
                  await executorMember.roles.set([]).catch(() => null);
                }
                const embed = new EmbedBuilder()
                  .setTitle('{emoji:shield} محاولة إعطاء رتبة إدارة غير مصرحة')
                  .setColor(0xff0000)
                  .addFields(
                    { name: 'العضو المستهدف', value: `<@${newMember.id}>`, inline: true },
                    { name: 'الفاعل (المشرف)', value: `<@${executor.id}>`, inline: true },
                    {
                      name: 'الإجراء المتخذ',
                      value: 'تم سحب رتبة الإدارة من العضو، وتجريد المشرف من كافة رتبه',
                      inline: false
                    }
                  )
                  .setTimestamp();
                await sendLog(guild.client, guild.id, embed, 'protection');
                return;
              }
            }
          }

          const embed = new EmbedBuilder()
            .setAuthor({ name: newMember.user?.tag || 'User', iconURL: newMember.user?.displayAvatarURL() })
            .setTitle('{emoji:settings} تم إضافة رتبة لعضو')
            .addFields(
              { name: 'العضو', value: `<@${newMember.id}>`, inline: true },
              { name: 'الرتبة المُضافة', value: addedRoles.map((r) => `<@&${r.id}>`).join(', '), inline: true }
            )
            .setColor(0x00ff00)
            .setTimestamp();
          await sendLog(guild.client, guild.id, embed, 'nick_change');
        }

        if (removedRoles.size > 0) {
          const embed = new EmbedBuilder()
            .setAuthor({ name: newMember.user?.tag || 'User', iconURL: newMember.user?.displayAvatarURL() })
            .setTitle('{emoji:trash} تم إزالة رتبة من عضو')
            .addFields(
              { name: 'العضو', value: `<@${newMember.id}>`, inline: true },
              { name: 'الرتبة المُزالة', value: removedRoles.map((r) => `<@&${r.id}>`).join(', '), inline: true }
            )
            .setColor(0xff0000)
            .setTimestamp();
          await sendLog(guild.client, guild.id, embed, 'nick_change');
        }
      }
    } catch (err) {
      logger.error('Error in guildMemberUpdate event:', err);
    }
  }
};
