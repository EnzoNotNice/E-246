const { Events } = require('discord.js');
const db = require('../database/db');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        return;
      }
    }

    const guildId = reaction.message?.guildId;
    if (!guildId) return;

    db.incrementReactionsCount(user.id, guildId);

    // ═══════════════════════════════════════════
    // Starboard handler
    // ═══════════════════════════════════════════
    const settings = db.getStarboardSettings(guildId);
    if (settings && settings.channelId && reaction.emoji.name === settings.emoji) {
      const stars = reaction.count;
      if (stars >= settings.threshold) {
        const starboardChannel = reaction.message.guild.channels.cache.get(settings.channelId);
        if (starboardChannel) {
          const starboardPost = db.getStarboardPost(reaction.message.id);
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setAuthor({
              name: reaction.message.author.tag,
              iconURL: reaction.message.author.displayAvatarURL({})
            })
            .setDescription(reaction.message.content || '_رسالة فارغة (صورة أو ملف)_')
            .addFields({
              name: 'المصدر',
              value: `[انتقال للرسالة](${reaction.message.url}) في <#${reaction.message.channelId}>`
            })
            .setTimestamp(reaction.message.createdAt);

          if (reaction.message.attachments && reaction.message.attachments.size > 0) {
            const attachment = reaction.message.attachments.first();
            if (attachment && attachment.contentType && attachment.contentType.startsWith('image/')) {
              embed.setImage(attachment.url);
            }
          }

          const contentStr = `${settings.emoji} **${stars}** | <#${reaction.message.channelId}>`;

          if (starboardPost) {
            const starMessage = await starboardChannel.messages
              .fetch(starboardPost.starboardMessageId)
              .catch(() => null);
            if (starMessage) {
              await starMessage.edit({ content: contentStr, embeds: [embed] }).catch(() => null);
              db.updateStarboardPost(reaction.message.id, stars);
            }
          } else {
            const newMsg = await starboardChannel.send({ content: contentStr, embeds: [embed] }).catch(() => null);
            if (newMsg) {
              db.addStarboardPost(guildId, reaction.message.id, newMsg.id, stars);
            }
          }
        }
      }
    }

    const emojiIdOrName = reaction.emoji?.id || reaction.emoji?.name;
    const reactRole = db.getReactRole(reaction.message.id, emojiIdOrName);

    if (reactRole) {
      const member = await reaction.message.guild?.members.fetch(user.id).catch(() => null);
      if (member) {
        const role = reaction.message.guild?.roles.cache.get(reactRole.roleId);
        if (role) {
          await member.roles.add(role).catch((err) => logger.error(err));
        }
      }
    }
  }
};
