const fs = require('fs');
const path = require('path');
const { EmbedBuilder, MessagePayload } = require('discord.js');

const emojisJsonPath = path.join(__dirname, 'emojis.json');


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


function replaceEmojis(text) {
    if (typeof text !== 'string') return text;
    const emojis = getEmojis();
    
    
    let result = text.replace(/<(a)?:(\w{2,32}):(\d{17,20})>/g, (match, animated, name, id) => {
        const freshEmoji = emojis[name];
        if (freshEmoji) {
            return freshEmoji;
        }
        return match;
    });

    
    result = result.replace(/{emoji:(\w+)}/g, (match, name) => {
        const freshEmoji = emojis[name];
        if (freshEmoji) {
            return freshEmoji;
        }
        
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
            alerttriangle: '<:alerttriangle:1519212253054767205>',
            confetti: '🎉',
            message: '💬',
            mic: '🎙️',
            settings: '⚙️',
            chartpie: '📊',
            star: '⭐',
            crown: '👑',
            ticket: '🎫',
            adjustments: '🛠️',
            folderopen: '📂',
            folder: '📁',
            gift: '🎁',
            music_play: '▶️',
            infocircle: 'ℹ️'
        };
        return fallbacks[name] || match;
    });

    return result;
}


function replaceEmojisInObject(obj) {
    if (typeof obj === 'string') {
        return replaceEmojis(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(replaceEmojisInObject);
    }
    if (obj !== null && typeof obj === 'object') {
        
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


const originalResolveBody = MessagePayload.prototype.resolveBody;
MessagePayload.prototype.resolveBody = function() {
    originalResolveBody.call(this);
    if (this.body) {
        this.body = replaceEmojisInObject(this.body);
    }
    return this;
};

console.log('[EmojiReplacer] Global Discord Emoji translation hook initialized.');
