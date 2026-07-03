const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const guild = oldMember.guild;

        // Nickname change
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

        // Roles change
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        if (oldRoles.size !== newRoles.size) {
            const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
            const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

            if (addedRoles.size > 0) {
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
