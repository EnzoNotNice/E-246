const { Events } = require('discord.js');
const { db } = require('../database/db');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

        if (reaction.partial) {
            try { await reaction.fetch(); } catch (error) { return; }
        }

        const guildId = reaction.message.guildId;
        if (!guildId) return;

        // Update Reactions Count
        let userLevel = db.prepare('SELECT * FROM levels WHERE userId = ? AND guildId = ?').get(user.id, guildId);
        if (!userLevel) {
            db.prepare('INSERT INTO levels (userId, guildId) VALUES (?, ?)').run(user.id, guildId);
            userLevel = { reactionsCount: 0 };
        }
        db.prepare('UPDATE levels SET reactionsCount = COALESCE(reactionsCount, 0) + 1 WHERE userId = ? AND guildId = ?').run(user.id, guildId);

        // React Roles
        const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
        const reactRole = db.prepare('SELECT * FROM reactroles WHERE messageId = ? AND emoji = ?').get(reaction.message.id, emojiIdOrName);
        
        if (reactRole) {
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (member) {
                const role = reaction.message.guild.roles.cache.get(reactRole.roleId);
                if (role) {
                    await member.roles.add(role).catch(console.error);
                }
            }
        }
    },
};
