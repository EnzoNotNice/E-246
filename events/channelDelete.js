const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!channel.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('➖ تم حذف روم')
            .addFields(
                { name: 'اسم الروم', value: channel.name, inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `ID: ${channel.id}` });

        await sendLog(channel.client, channel.guild.id, embed, 'channel_delete');
    },
};
