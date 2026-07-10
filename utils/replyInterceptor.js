const { CommandInteraction, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

function convertEmbedsToText(options) {
    if (!options) return options;
    
    
    if (typeof options === 'string') {
        options = { content: options };
    }

    let embeds = [];
    if (options.embeds) {
        embeds = options.embeds;
    }

    if (!embeds || embeds.length === 0) return options;

    let plainText = '';
    for (const embedData of embeds) {
        const embed = embedData instanceof EmbedBuilder ? embedData.data : embedData;
        if (!embed) continue;

        let parts = [];
        if (embed.title) parts.push(`**${embed.title}**`);
        if (embed.description) parts.push(embed.description);
        if (embed.fields) {
            for (const f of embed.fields) {
                parts.push(`**${f.name}**\n${f.value}`);
            }
        }
        if (embed.footer?.text) parts.push(`_${embed.footer.text}_`);
        
        if (parts.length > 0) {
            plainText += parts.join('\n\n') + '\n\n';
        }
    }

    if (plainText.trim()) {
        options.content = (options.content ? options.content + '\n\n' : '') + plainText.trim();
        // Remove embeds since they are now converted to text
        delete options.embeds;
    }

    return options;
}

// Backup original methods
const originalReply = CommandInteraction.prototype.reply;
const originalEditReply = CommandInteraction.prototype.editReply;
const originalFollowUp = CommandInteraction.prototype.followUp;

CommandInteraction.prototype.reply = function(options) {
    try {
        const guildId = this.guildId;
        if (guildId) {
            const settings = db.getGuildSettings(guildId);
            if (settings && settings.reply_type === 'normal') {
                options = convertEmbedsToText(options);
            }
        }
    } catch (e) {
        console.error('[ReplyInterceptor] Error in reply override:', e);
    }
    return originalReply.call(this, options);
};

CommandInteraction.prototype.editReply = function(options) {
    try {
        const guildId = this.guildId;
        if (guildId) {
            const settings = db.getGuildSettings(guildId);
            if (settings && settings.reply_type === 'normal') {
                options = convertEmbedsToText(options);
            }
        }
    } catch (e) {
        console.error('[ReplyInterceptor] Error in editReply override:', e);
    }
    return originalEditReply.call(this, options);
};

CommandInteraction.prototype.followUp = function(options) {
    try {
        const guildId = this.guildId;
        if (guildId) {
            const settings = db.getGuildSettings(guildId);
            if (settings && settings.reply_type === 'normal') {
                options = convertEmbedsToText(options);
            }
        }
    } catch (e) {
        console.error('[ReplyInterceptor] Error in followUp override:', e);
    }
    return originalFollowUp.call(this, options);
};

console.log('[ReplyInterceptor] Command Interaction reply formatting hook initialized.');
