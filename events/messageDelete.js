const db = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    try {
      if (!message || !message.guild) return;

      let authorId = message.author?.id || null;
      let authorTag = message.author?.tag || null;
      let authorAvatar = message.author ? message.author.displayAvatarURL() : null;
      let content = message.content || null;
      let attachments = message.attachments ? message.attachments.map(att => att.url) : [];

      const cached = await db.getCachedMessage(message.id).catch(() => null);
      if (cached) {
        authorId = cached.authorId;
        authorTag = cached.authorTag;
        authorAvatar = cached.authorAvatar;
        content = cached.content;
        attachments = cached.attachments || [];
      }

      if (message.author?.bot) return;
      if (authorId) {
        const user = message.client?.users?.cache?.get(authorId);
        if (user?.bot) return;
      }

      if (content && authorId) {
        db.setSnipe(
          message.channelId,
          content,
          authorId,
          authorTag || 'مجهول',
          authorAvatar || ''
        );
      }

      const memberMention = authorId ? `<@${authorId}>` : 'غير معروف';
      const tagDisplay = authorTag ? `${authorTag}` : 'غير معروف';
      const authorDisplay = authorId ? `${tagDisplay} (${authorId})` : 'غير معروف';

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('{emoji:trash} رسالة محذوفة')
        .setDescription(`**المرسل** ${memberMention} (${authorDisplay})\n**الروم** ${message.channel}\n**المحتوى**\n${content || '*[بدون محتوى]*'}`)
        .setTimestamp();

      if (attachments && attachments.length > 0) {
        embed.addFields({ name: 'المرفقات', value: attachments.map((url, index) => `[مرفق ${index + 1}](${url})`).join('\n') });
      }

      await sendLog(message.client, message.guildId, embed, 'message_delete').catch(() => null);
    } catch (err) {
      console.error('[messageDelete Error]:', err);
    }
  }
};
