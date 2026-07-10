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
    const emojisDir = path.join(__dirname, '..', 'assets', 'emojis');
    const emojisJsonPath = path.join(__dirname, '..', 'utils', 'emojis.json');

    if (!fs.existsSync(emojisDir)) {
        console.log('[EmojiSetup] Emojis directory not found at assets/emojis. Skipping.');
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

        let uploadedCount = 0;

        for (const file of files) {
            const ext = path.extname(file);
            if (ext !== '.png' && ext !== '.gif') continue;
            const name = path.basename(file, ext);
            
            const isAnimated = ext === '.gif';
            const mime = isAnimated ? 'image/gif' : 'image/png';
            
            let emojiObj = existingMap.get(name);

            if (!emojiObj) {
                console.log(`[EmojiSetup] Uploading missing emoji: ${name}...`);
                const filePath = path.join(emojisDir, file);
                const fileData = fs.readFileSync(filePath);
                const base64Image = `data:${mime};base64,${fileData.toString('base64')}`;

                try {
                    emojiObj = await request('POST', `/applications/${botId}/emojis`, token, {
                        name: name,
                        image: base64Image
                    });
                    uploadedCount++;
                    
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    console.error(`[EmojiSetup] Failed to upload ${name}:`, e.message);
                    continue;
                }
            }

            const format = isAnimated 
                ? `<a:${emojiObj.name}:${emojiObj.id}>` 
                : `<:${emojiObj.name}:${emojiObj.id}>`;
            
            emojisJson[name] = format;
        }

        fs.writeFileSync(emojisJsonPath, JSON.stringify(emojisJson, null, 4));
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
