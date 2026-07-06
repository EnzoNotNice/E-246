const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const guild = oldMember.guild;

        if (oldMember.nickname !== newMember.nickname) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                .setTitle('📝 تغيير اللقب (Nickname)')
                .addFields(
                    { name: 'العضو', value: `<@${newMember.id}>`, inline: false },
                    { name: 'اللقب القديم', value: oldMember.nickname || 'بدون لقب', inline: true },
                    { name: 'اللقب الجديد', value: newMember.nickname || 'بدون لقب', inline: true }
                )
                .setColor(0x00BFFF)
                .setTimestamp()
                .setFooter({ text: `ID: ${newMember.id}` });
            await sendLog(guild.client, guild.id, embed, 'nick_change');
        }

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        if (oldRoles.size !== newRoles.size) {
            const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
            const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

            if (addedRoles.size > 0) {
                const hasAdmin = addedRoles.some(r => r.permissions.has(PermissionFlagsBits.Administrator));
                if (hasAdmin) {
                    const db = require('../database/db');
                    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 }).catch(() => null);
                    const entry = auditLogs ? auditLogs.entries.first() : null;
                    if (entry && entry.targetId === newMember.id && entry.executor) {
                        const executor = entry.executor;
                        if (executor.id !== guild.ownerId && !db.isWhitelisted(guild.id, executor.id) && executor.id !== guild.client.user.id) {
                            await newMember.roles.remove(addedRoles.filter(r => r.permissions.has(PermissionFlagsBits.Administrator))).catch(() => null);
                            const executorMember = await guild.members.fetch(executor.id).catch(() => null);
                            if (executorMember) {
                                await executorMember.roles.set([]).catch(() => null);
                            }
                            const embed = new EmbedBuilder()
                                .setTitle('{emoji:shield} محاولة إعطاء رتبة إدارة غير مصرحة')
                                .setColor(0xFF0000)
                                .addFields(
                                    { name: 'العضو المستهدف', value: `<@${newMember.id}>`, inline: true },
                                    { name: 'الفاعل (المشرف)', value: `<@${executor.id}>`, inline: true },
                                    { name: 'الإجراء المتخذ', value: 'تم سحب رتبة الإدارة من العضو، وتجريد المشرف من كافة رتبه', inline: false }
                                )
                                .setTimestamp();
                            await sendLog(guild.client, guild.id, embed, 'protection');
                            return;
                        }
                    }
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                    .setTitle('🏷️ تم إضافة رتبة لعضو')
                    .addFields(
                        { name: 'العضو', value: `<@${newMember.id}>`, inline: true },
                        { name: 'الرتبة المُضافة', value: addedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();
                await sendLog(guild.client, guild.id, embed, 'nick_change');
            }

            if (removedRoles.size > 0) {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                    .setTitle('🏷️ تم إزالة رتبة من عضو')
                    .addFields(
                        { name: 'العضو', value: `<@${newMember.id}>`, inline: true },
                        { name: 'الرتبة المُزالة', value: removedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();
                await sendLog(guild.client, guild.id, embed, 'nick_change');
            }
        }
    },
};
