const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
            .setTitle('🔨 تم حظر عضو (Ban)')
            .addFields(
                { name: 'العضو', value: `<@${ban.user.id}>`, inline: true },
                { name: 'السبب', value: ban.reason || 'بدون سبب', inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `ID: ${ban.user.id}` });

        await sendLog(ban.client, ban.guild.id, embed, 'ban');
    },
};
