const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');

module.exports = {
    name: Events.GuildRoleCreate,
    async execute(role) {
        const embed = new EmbedBuilder()
            .setTitle('{emoji:settings} تم إنشاء رتبة جديدة')
            .addFields(
                { name: 'الرتبة', value: `<@&${role.id}>`, inline: true },
                { name: 'اللون', value: role.hexColor, inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: `ID: ${role.id}` });

        await sendLog(role.client, role.guild.id, embed, 'role_create');

        try {
            const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
            const entry = logs.entries.first();
            if (entry && entry.target?.id === role.id && Date.now() - entry.createdTimestamp < 15000) {
                await handleLimit(role.guild, entry.executor, 'role', 'role_limit', 'تجاوز حد الرتب');
            }
        } catch (_) {}
    },
};
