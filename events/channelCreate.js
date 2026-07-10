const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        if (!channel.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('{emoji:circlecheck} تم إنشاء روم')
            .addFields(
                { name: 'اسم الروم', value: `<#${channel.id}>`, inline: true },
                { name: 'النوع', value: channel.type.toString(), inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: `ID: ${channel.id}` });

        await sendLog(channel.client, channel.guild.id, embed, 'channel_create');
    },
};
