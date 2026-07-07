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
    
    // 1. Replace <:name:id> or <a:name:id> format
    let result = text.replace(/<(a)?:(\w{2,32}):(\d{17,20})>/g, (match, animated, name, id) => {
        const freshEmoji = emojis[name];
        if (freshEmoji) {
            return freshEmoji;
        }
        return match;
    });

    // 2. Replace {emoji:name} format used in locales
    result = result.replace(/{emoji:(\w+)}/g, (match, name) => {
        const freshEmoji = emojis[name];
        if (freshEmoji) {
            return freshEmoji;
        }
        // Fallback IDs if they are not in emojis.json yet
        const fallbacks = {
            user: '<:user:1519212186633764995>',
            circlecheck: '<:circlecheck:1519212246876557413>',
            circlex: '<:circlex:1519212245559672914>',
            mail: '<:mail:1519212229445029971>',
            trash: '<:trash:1519212192912637962>',
            lock: '<:lock:1519212231332593785>',
            clock: '<:clock:1519212244263632916>',
            shield: '<:shield:1519212202676977788>',
            shieldlock: '<:shieldlock:1519212205638287522>',
            list: '<:list:1519212232670580868>',
            alerttriangle: '<:alerttriangle:1519212253054767205>'
        };
        return fallbacks[name] || match;
    });

    return result;
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

// Hook EmbedBuilder and ModalBuilder to automatically replace emojis when serialized
const originalToJSON = EmbedBuilder.prototype.toJSON;
EmbedBuilder.prototype.toJSON = function() {
    const json = originalToJSON.call(this);
    return replaceEmojisInObject(json);
};

const { ModalBuilder } = require('discord.js');
const originalModalToJSON = ModalBuilder.prototype.toJSON;
ModalBuilder.prototype.toJSON = function() {
    const json = originalModalToJSON.call(this);
    return replaceEmojisInObject(json);
};

// Hook MessagePayload to clean content/embeds/components right before dispatching to API
const originalResolveBody = MessagePayload.prototype.resolveBody;
MessagePayload.prototype.resolveBody = function() {
    originalResolveBody.call(this);
    if (this.body) {
        this.body = replaceEmojisInObject(this.body);
    }
    return this;
};

console.log('[EmojiReplacer] Global Discord Emoji translation hook initialized.');
