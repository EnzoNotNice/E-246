const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!channel.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('{emoji:circlex} تم حذف روم')
            .addFields(
                { name: 'اسم الروم', value: channel.name, inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `ID: ${channel.id}` });

        await sendLog(channel.client, channel.guild.id, embed, 'channel_delete');

        try {
            const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
            const entry = logs.entries.first();
            if (entry && entry.target?.id === channel.id && Date.now() - entry.createdTimestamp < 15000) {
                await handleLimit(channel.guild, entry.executor, 'channel', 'channel_limit', 'تجاوز حد القنوات');
            }
        } catch (_) {}
    },
};
