const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        try {
            if (!oldMessage || !newMessage || !oldMessage.guild || !oldMessage.author || oldMessage.author.bot) return;
            if (oldMessage.content === newMessage.content) return;

            const embed = new EmbedBuilder()
                .setAuthor({ name: oldMessage.author.tag || 'عضو', iconURL: oldMessage.author.displayAvatarURL ? oldMessage.author.displayAvatarURL() : null })
                .setTitle('{emoji:message} تم تعديل رسالة')
                .addFields(
                    { name: 'المرسل', value: `<@${oldMessage.author.id}>`, inline: true },
                    { name: 'الروم', value: `<#${oldMessage.channel?.id || ''}>`, inline: true },
                    { name: 'قبل التعديل', value: (oldMessage.content || 'بدون نص').substring(0, 1024), inline: false },
                    { name: 'بعد التعديل', value: (newMessage.content || 'بدون نص').substring(0, 1024), inline: false }
                )
                .setColor(0xFFA500)
                .setTimestamp()
                .setFooter({ text: `ID: ${oldMessage.author.id}` });

            await sendLog(oldMessage.client, oldMessage.guild.id, embed, 'message_edit').catch(() => null);
        } catch (err) {
            console.error('[messageUpdate Error]:', err);
        }
    },
};
