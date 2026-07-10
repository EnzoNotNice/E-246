const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
            .setTitle('{emoji:shieldcheck} تم فك الحظر عن عضو (Unban)')
            .addFields(
                { name: 'العضو', value: `<@${ban.user.id}>`, inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: `ID: ${ban.user.id}` });

        await sendLog(ban.client, ban.guild.id, embed, 'unban');
    },
};
