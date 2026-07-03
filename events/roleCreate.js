const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildRoleCreate,
    async execute(role) {
        const embed = new EmbedBuilder()
            .setTitle('➕ تم إنشاء رتبة جديدة')
            .addFields(
                { name: 'الرتبة', value: `<@&${role.id}>`, inline: true },
                { name: 'اللون', value: role.hexColor, inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: `ID: ${role.id}` });

        await sendLog(role.client, role.guild.id, embed, 'role_create');
    },
};
