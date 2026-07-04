const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!oldMessage.guild || !oldMessage.author || oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
            .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
            .setTitle('✏️ تم تعديل رسالة')
            .addFields(
                { name: 'المرسل', value: `<@${oldMessage.author.id}>`, inline: true },
                { name: 'الروم', value: `<#${oldMessage.channel.id}>`, inline: true },
                { name: 'قبل التعديل', value: oldMessage.content || 'بدون نص', inline: false },
                { name: 'بعد التعديل', value: newMessage.content || 'بدون نص', inline: false }
            )
            .setColor(0xFFA500)
            .setTimestamp()
            .setFooter({ text: `ID: ${oldMessage.author.id}` });

        await sendLog(oldMessage.client, oldMessage.guild.id, embed, 'message_edit');
    },
};
