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
