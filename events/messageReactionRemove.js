const { Events } = require('discord.js');
const db = require('../database/db');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    try {
      if (!user || user.bot) return;

      if (reaction?.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          return;
        }
      }

      const guildId = reaction?.message?.guildId;
      if (!guildId) return;

      const emojiIdOrName = reaction.emoji?.id || reaction.emoji?.name;
      if (!emojiIdOrName || !reaction.message?.id) return;

      // ═══════════════════════════════════════════
      // Starboard handler
      // ═══════════════════════════════════════════
      const settings = db.getStarboardSettings(guildId);
      if (settings && settings.channelId && reaction.emoji.name === settings.emoji) {
        const starboardPost = db.getStarboardPost(reaction.message.id);
        if (starboardPost) {
          const stars = reaction.count;
          const starboardChannel = reaction.message.guild.channels.cache.get(settings.channelId);
          if (starboardChannel) {
            if (stars < settings.threshold) {
              const starMessage = await starboardChannel.messages
                .fetch(starboardPost.starboardMessageId)
                .catch(() => null);
              if (starMessage) await starMessage.delete().catch(() => null);
              db.removeStarboardPost(reaction.message.id);
            } else {
              const starMessage = await starboardChannel.messages
                .fetch(starboardPost.starboardMessageId)
                .catch(() => null);
              if (starMessage) {
                const contentStr = `${settings.emoji} **${stars}** | <#${reaction.message.channelId}>`;
                await starMessage.edit({ content: contentStr }).catch(() => null);
                db.updateStarboardPost(reaction.message.id, stars);
              }
            }
          }
        }
      }

      const reactRole = db.getReactRole(reaction.message.id, emojiIdOrName);

      if (reactRole) {
        const member = await reaction.message.guild?.members?.fetch(user.id).catch(() => null);
        if (member) {
          const role = reaction.message.guild?.roles?.cache?.get(reactRole.roleId);
          if (role) {
            await member.roles.remove(role).catch((err) => logger.error(err));
          }
        }
      }
    } catch (err) {
      logger.error('Error in messageReactionRemove event:', err);
    }
  }
};
