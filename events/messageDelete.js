const db = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    if (message.content && message.author) {
      db.setSnipe(
        message.channelId,
        message.content,
        message.author.id,
        message.author.tag,
        message.author.displayAvatarURL()
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('{emoji:trash} رسالة محذوفة')
      .setDescription(`**المرسل** ${message.author ? message.author.tag : 'غير معروف'} (${message.author?.id || 'غير معروف'})\n**الروم** ${message.channel}\n**المحتوى**\n${message.content || '*[بدون محتوى]*'}`)
      .setTimestamp();

    await sendLog(message.client, message.guildId, embed, 'message_delete');
  }
};
