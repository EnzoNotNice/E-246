const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        const embed = new EmbedBuilder()
            .setTitle('{emoji:trash} تم حذف رتبة')
            .addFields(
                { name: 'اسم الرتبة', value: role.name, inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `ID: ${role.id}` });

        await sendLog(role.client, role.guild.id, embed, 'role_delete');

        try {
            const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
            const entry = logs.entries.first();
            if (entry && entry.target?.id === role.id && Date.now() - entry.createdTimestamp < 15000) {
                await handleLimit(role.guild, entry.executor, 'role', 'role_limit', 'تجاوز حد الرتب');
            }
        } catch (_) {}
    },
};
