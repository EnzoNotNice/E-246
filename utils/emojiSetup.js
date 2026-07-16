const fs = require('fs');
const path = require('path');
const https = require('https');

function request(method, urlPath, token, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'discord.com',
            port: 443,
            path: `/api/v10${urlPath}`,
            method: method,
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = {};
                try { json = JSON.parse(data); } catch(e) {}
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(json);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
                }
            });
        });

        req.on('error', err => reject(err));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function emojiSetup(client) {
    const db = require('../database/db');
    const recolorEmojis = require('./recolorEmojis');
    await recolorEmojis().catch(() => null);

    const settings = db.getBotSettings();
    const color = settings.emoji_color || 'blue';
    const emojisDir = path.join(__dirname, '..', 'assets', 'emojis', color);
    const emojisJsonPath = path.join(__dirname, '..', 'utils', 'emojis.json');

    if (!fs.existsSync(emojisDir)) {
        console.log('[EmojiSetup] Emojis directory not found at ' + emojisDir + '. Skipping.');
        return;
    }

    try {
        const botId = client.user.id;
        const token = client.token || process.env.DISCORD_TOKEN;

        console.log('[EmojiSetup] Checking Application Emojis...');
        const existing = await request('GET', `/applications/${botId}/emojis`, token);
        const emojiList = Array.isArray(existing) ? existing : (existing.items || []);
        const existingMap = new Map(emojiList.map(item => [item.name, item]));

        const files = fs.readdirSync(emojisDir);
        let emojisJson = {};
        if (fs.existsSync(emojisJsonPath)) {
            try { emojisJson = JSON.parse(fs.readFileSync(emojisJsonPath, 'utf8')); } catch(e) {}
        }

        const colorPrefixes = {
            blue: 'b',
            red: 'r',
            green: 'g',
            purple: 'p',
            gold: 'y',
            pink: 'pk'
        };
        const prefix = colorPrefixes[color] || 'b';

        let uploadedCount = 0;
        const freshEmojisJson = { __color__: color };

        for (const file of files) {
            const ext = path.extname(file);
            if (ext !== '.png' && ext !== '.gif') continue;
            const name = path.basename(file, ext);
            
            const isAnimated = ext === '.gif';
            const mime = isAnimated ? 'image/gif' : 'image/png';
            const discordName = `${prefix}_${name}`;
            
            let emojiObj = existingMap.get(discordName);

            if (!emojiObj) {
                console.log(`[EmojiSetup] Uploading missing emoji: ${discordName}...`);
                const filePath = path.join(emojisDir, file);
                const fileData = fs.readFileSync(filePath);
                const base64Image = `data:${mime};base64,${fileData.toString('base64')}`;

                try {
                    emojiObj = await request('POST', `/applications/${botId}/emojis`, token, {
                        name: discordName,
                        image: base64Image
                    });
                    uploadedCount++;
                    existingMap.set(discordName, emojiObj);
                    
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {
                    console.error(`[EmojiSetup] Failed to upload ${discordName}:`, e.message);
                    continue;
                }
            }

            const format = isAnimated 
                ? `<a:${emojiObj.name}:${emojiObj.id}>` 
                : `<:${emojiObj.name}:${emojiObj.id}>`;
            
            freshEmojisJson[name] = format;
        }

        freshEmojisJson.__color__ = color;
        fs.writeFileSync(emojisJsonPath, JSON.stringify(freshEmojisJson, null, 4));
        if (uploadedCount > 0) {
            console.log(`[EmojiSetup] Successfully uploaded ${uploadedCount} new application emojis and updated emojis.json.`);
        } else {
            console.log('[EmojiSetup] All application emojis are up to date.');
        }

    } catch (error) {
        console.error('[EmojiSetup] Error configuring application emojis:', error.message || error);
    }
}

module.exports = emojiSetup;
