const { Events } = require('discord.js');
const { db } = require('../database/db');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (user.bot) return;

        if (reaction.partial) {
            try { await reaction.fetch(); } catch (error) { return; }
        }

        const guildId = reaction.message.guildId;
        if (!guildId) return;

        
        const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
        const reactRole = db.prepare('SELECT * FROM reactroles WHERE messageId = ? AND emoji = ?').get(reaction.message.id, emojiIdOrName);
        
        if (reactRole) {
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (member) {
                const role = reaction.message.guild.roles.cache.get(reactRole.roleId);
                if (role) {
                    await member.roles.remove(role).catch(console.error);
                }
            }
        }
    },
};
