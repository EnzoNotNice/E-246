const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

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
    },
};
