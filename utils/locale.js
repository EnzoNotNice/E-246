const fs = require('fs');
const path = require('path');

class LocaleManager {
    constructor() {
        this.localePath = path.join(__dirname, 'locales', 'ar.json');
        this.data = {};
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.localePath)) {
                const raw = fs.readFileSync(this.localePath, 'utf8');
                this.data = JSON.parse(raw);
            } else {
                this.data = {};
                this.save();
            }
        } catch (e) {
            console.error("Error loading locale file:", e);
        }
    }

    save() {
        try {
            fs.writeFileSync(this.localePath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (e) {
            console.error("Error saving locale file:", e);
        }
    }

    get(key, options = {}) {
        const keys = key.split('.');
        let result = this.data;
        for (const k of keys) {
            if (result[k] === undefined) {
                return `MissingLocale:${key}`;
            }
            result = result[k];
        }

        if (typeof result === 'string') {
            for (const [k, v] of Object.entries(options)) {
                result = result.replace(new RegExp(`{${k}}`, 'g'), v);
            }
            
            // Replace {emoji:name} placeholders dynamically
            try {
                const emojis = require('./emojis.json');
                result = result.replace(/{emoji:(\w+)}/g, (match, name) => {
                    const freshEmoji = emojis[name];
                    if (freshEmoji) return freshEmoji;
                    const fallbacks = {
                        user: '{emoji:user}',
                        circlecheck: '{emoji:circlecheck}',
                        circlex: '{emoji:circlex}',
                        mail: '{emoji:mail}',
                        trash: '{emoji:trash}',
                        lock: '{emoji:lock}',
                        clock: '{emoji:clock}',
                        shield: '{emoji:shield}',
                        shieldlock: '{emoji:shieldlock}',
                        list: '{emoji:list}',
                        alerttriangle: '{emoji:alerttriangle}'
                    };
                    return fallbacks[name] || match;
                });
            } catch (err) {}
        }
        return result;
    }

    getButton(key) {
        const keys = key.split('.');
        let result = this.data;
        for (const k of keys) {
            if (result[k] === undefined) {
                return { label: 'Missing', emoji: '❓' };
            }
            result = result[k];
        }
        return result;
    }

    updateData(newData) {
        this.data = newData;
        this.save();
    }
}

module.exports = new LocaleManager();
