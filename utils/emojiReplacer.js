const fs = require('fs');
const path = require('path');
const { EmbedBuilder, MessagePayload } = require('discord.js');

const emojisJsonPath = path.join(__dirname, 'emojis.json');

// Helper to load current emojis.json dynamically
function getEmojis() {
    try {
        if (fs.existsSync(emojisJsonPath)) {
            return JSON.parse(fs.readFileSync(emojisJsonPath, 'utf8'));
        }
    } catch (e) {
        console.error('[EmojiReplacer] Error loading emojis.json:', e);
    }
    return {};
}

// Replaces any old <:name:id> or <a:name:id> format with the current uploaded version
function replaceEmojis(text) {
    if (typeof text !== 'string') return text;
    const emojis = getEmojis();
    return text.replace(/<(a)?:(\w{2,32}):(\d{17,20})>/g, (match, animated, name, id) => {
        const freshEmoji = emojis[name];
        if (freshEmoji) {
            return freshEmoji;
        }
        return match;
    });
}

// Deep replace in plain JSON/Objects (like final API payloads)
function replaceEmojisInObject(obj) {
    if (typeof obj === 'string') {
        return replaceEmojis(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(replaceEmojisInObject);
    }
    if (obj !== null && typeof obj === 'object') {
        // Skip non-plain objects to prevent mutating class instances directly
        const proto = Object.getPrototypeOf(obj);
        if (proto !== null && proto !== Object.prototype) {
            return obj;
        }
        
        const newObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = replaceEmojisInObject(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
}

// Hook EmbedBuilder to automatically replace emojis when serialized
const originalToJSON = EmbedBuilder.prototype.toJSON;
EmbedBuilder.prototype.toJSON = function() {
    const json = originalToJSON.call(this);
    return replaceEmojisInObject(json);
};

// Hook MessagePayload to clean content/embeds/components right before dispatching to API
const originalResolveData = MessagePayload.prototype.resolveData;
MessagePayload.prototype.resolveData = function() {
    originalResolveData.call(this);
    if (this.data) {
        this.data = replaceEmojisInObject(this.data);
    }
    return this;
};

console.log('[EmojiReplacer] Global Discord Emoji translation hook initialized.');
