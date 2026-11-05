const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const logger = require('../utils/logger');
const { sendLog } = logger;

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    try {
      if (!newMessage || !newMessage.guild) return;
      if (newMessage.author?.bot) return;

      let oldContent = oldMessage?.content || null;
      let author = newMessage.author || oldMessage?.author;

      if (!oldContent) {
        const cached = await db.getCachedMessage(newMessage.id).catch(() => null);
        if (cached) {
          oldContent = cached.content;
          if (!author && cached.authorId) {
            author = {
              id: cached.authorId,
              tag: cached.authorTag,
              displayAvatarURL: () => cached.authorAvatar
            };
          }
        }
      }

      if (!author || author.bot) return;
      if (!oldContent || oldContent === newMessage.content) return;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: author.tag || 'عضو',
          iconURL: typeof author.displayAvatarURL === 'function' ? author.displayAvatarURL() : null
        })
        .setTitle('{emoji:message} تم تعديل رسالة')
        .addFields(
          { name: 'المرسل', value: `<@${author.id}>`, inline: true },
          { name: 'الروم', value: `<#${newMessage.channel?.id || ''}>`, inline: true },
          { name: 'قبل التعديل', value: oldContent.substring(0, 1024), inline: false },
          { name: 'بعد التعديل', value: (newMessage.content || 'بدون نص').substring(0, 1024), inline: false }
        )
        .setColor(0xffa500)
        .setTimestamp()
        .setFooter({ text: `ID: ${author.id}` });

      await sendLog(newMessage.client, newMessage.guild.id, embed, 'message_edit').catch(() => null);

      // Update cached message with the new content
      const atts = newMessage.attachments ? newMessage.attachments.map((att) => att.url) : [];
      db.saveMessage(
        newMessage.id,
        newMessage.channelId,
        newMessage.guild.id,
        author.id,
        author.tag,
        typeof author.displayAvatarURL === 'function' ? author.displayAvatarURL() : null,
        newMessage.content,
        atts
      );
    } catch (err) {
      logger.error('[messageUpdate Error]:', err);
    }
  }
};
