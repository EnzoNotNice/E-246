const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

try {
    registerFont(path.join(__dirname, '../assets/font.ttf'), { family: 'CustomFont' });
    registerFont(path.join(__dirname, '../assets/fonts/IBMPlexSansArabic-Bold.ttf'), { family: 'IBMPlexSansArabic' });
} catch (e) {
    console.error('Failed to load fonts:', e.message);
}

async function fetchImage(url) {
    if (!url) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch image');
        const arrayBuffer = await res.arrayBuffer();
        return await loadImage(Buffer.from(arrayBuffer));
    } catch (e) {
        throw e;
    }
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawProgressBar(ctx, x, y, width, height, progress, color1, color2) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, x, y, width, height, height / 2);
    ctx.fill();

    if (progress > 0) {
        ctx.save();
        const pWidth = Math.max(height, width * progress);
        const gradient = ctx.createLinearGradient(x, y, x + pWidth, y);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);

        ctx.fillStyle = gradient;

        roundRect(ctx, x, y, pWidth, height, height / 2);
        ctx.fill();
        ctx.restore();
    }
}

async function createRankCard(user, textXp, textLevel, voiceTime, voiceLevel, messagesCount) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, 20, 20, 760, 260, 25);
    ctx.fillStyle = 'rgba(15, 15, 20, 0.75)';
    ctx.fill();
    ctx.restore();

    roundRect(ctx, 20, 20, 760, 260, 25);
    ctx.lineWidth = 2;
    const borderGrad = ctx.createLinearGradient(20, 20, 780, 280);
    borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
    ctx.strokeStyle = borderGrad;
    ctx.stroke();

    try {
        ctx.save();
        ctx.beginPath();
        ctx.arc(140, 150, 80, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        const avatar = await fetchImage(avatarUrl);
        if (avatar) {
            ctx.drawImage(avatar, 60, 70, 160, 160);
        }
        ctx.restore();

        if (typeof user.avatarDecorationURL === 'function') {
            const decUrl = user.avatarDecorationURL({ extension: 'png', size: 256 });
            if (decUrl) {
                const decoration = await fetchImage(decUrl);
                if (decoration) ctx.drawImage(decoration, 40, 50, 200, 200);
            }
        }
    } catch (e) {
        console.error('Canvas avatar error:', e.message);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "IBMPlexSansArabic", "CustomFont", sans-serif';
    ctx.fillText(user.username, 260, 100);

    const textCurrentLvlXp = 100 * Math.pow(textLevel, 2);
    const textNextLvlXp = 100 * Math.pow(textLevel + 1, 2);
    const textXpInLvl = textXp - textCurrentLvlXp;
    const textNeeded = textNextLvlXp - textCurrentLvlXp;
    const textProgress = Math.max(0, Math.min(1, textXpInLvl / textNeeded));

    const voiceMinutes = Math.floor(voiceTime / 60);
    const voiceCurrentLvlTime = 10 * Math.pow(voiceLevel, 2);
    const voiceNextLvlTime = 10 * Math.pow(voiceLevel + 1, 2);
    const voiceTimeInLvl = voiceMinutes - voiceCurrentLvlTime;
    const voiceNeeded = voiceNextLvlTime - voiceCurrentLvlTime;
    const voiceProgress = Math.max(0, Math.min(1, voiceTimeInLvl / voiceNeeded));

    ctx.font = '22px "IBMPlexSansArabic", "CustomFont", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

    try {
        const textIcon = await loadImage(path.join(__dirname, '../assets/text_icon.svg'));
        ctx.drawImage(textIcon, 260, 130, 24, 24);
    } catch (e) {}
    ctx.fillText(`مستوى الكتابة ${textLevel}`, 295, 150);
    ctx.font = '18px "IBMPlexSansArabic", "CustomFont", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const textXpStr = `${Math.floor(textXpInLvl)} / ${Math.floor(textNeeded)} XP`;
    ctx.fillText(textXpStr, 740 - ctx.measureText(textXpStr).width, 150);
    drawProgressBar(ctx, 260, 160, 480, 20, textProgress, '#5865F2', '#4752C4');

    ctx.font = '22px "IBMPlexSansArabic", "CustomFont", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    try {
        const voiceIcon = await loadImage(path.join(__dirname, '../assets/voice_icon.svg'));
        ctx.drawImage(voiceIcon, 260, 200, 24, 24);
    } catch (e) {}
    ctx.fillText(`مستوى الصوت ${voiceLevel}`, 295, 220);
    ctx.font = '18px "IBMPlexSansArabic", "CustomFont", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const voiceXpStr = `${Math.floor(voiceTimeInLvl)} / ${Math.floor(voiceNeeded)} XP`;
    ctx.fillText(voiceXpStr, 740 - ctx.measureText(voiceXpStr).width, 220);
    drawProgressBar(ctx, 260, 230, 480, 20, voiceProgress, '#5865F2', '#4752C4');

    return canvas.toBuffer();
}

async function createLeaderboardCanvas(guild, topUsers, requestingUserRank = null) {
    const client = guild.client;
    const mappedUsers = topUsers.map(userRecord => {
        const cloned = { ...userRecord };
        const sessionKey = `${guild.id}:${cloned.userId}`;
        if (client.voiceSessions && client.voiceSessions.has(sessionKey)) {
            const activeStart = client.voiceSessions.get(sessionKey);
            const liveSeconds = Math.floor((Date.now() - activeStart) / 1000);
            if (liveSeconds > 0) {
                cloned.voice_xp = (cloned.voice_xp || 0) + liveSeconds;
                const { getVoiceNextLvlTime } = require('./levels');
                let liveVoiceLevel = cloned.voice_level || 0;
                while (cloned.voice_xp >= getVoiceNextLvlTime(liveVoiceLevel)) {
                    liveVoiceLevel++;
                }
                cloned.voice_level = liveVoiceLevel;
            }
        }
        return cloned;
    });

    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px "IBMPlexSansArabic", "CustomFont", sans-serif';
    ctx.textAlign = 'center';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('لوحة الصدارة', 640, 80);
    ctx.shadowBlur = 0;

    const startY = 120;
    const cardHeight = 100;
    const spacing = 115;
    const cardWidth = 560;

    let textIcon = null;
    let voiceIcon = null;
    try {
        textIcon = await loadImage(path.join(__dirname, '../assets/text_icon.svg'));
        voiceIcon = await loadImage(path.join(__dirname, '../assets/voice_icon.svg'));
    } catch (e) {}

    async function drawUserCard(userRecord, x, y, rank) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        roundRect(ctx, x, y, cardWidth, cardHeight, 25);
        ctx.fillStyle = 'rgba(15, 15, 20, 0.75)';
        ctx.fill();
        ctx.restore();

        roundRect(ctx, x, y, cardWidth, cardHeight, 25);
        ctx.lineWidth = 2;
        const borderGrad = ctx.createLinearGradient(x, y, x + cardWidth, y + cardHeight);
        borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
        ctx.strokeStyle = borderGrad;
        ctx.stroke();

        try {
            const member = await guild.members.fetch(userRecord.userId).catch(() => null);
            if (member) {
                const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true });
                const avatar = await fetchImage(avatarUrl);
                if (avatar) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x + 60, y + 50, 35, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(avatar, x + 25, y + 15, 70, 70);
                    ctx.restore();
                }

                if (typeof member.user.avatarDecorationURL === 'function') {
                    const decUrl = member.user.avatarDecorationURL({ extension: 'png', size: 128 });
                    if (decUrl) {
                        const decoration = await fetchImage(decUrl);
                        if (decoration) ctx.drawImage(decoration, x + 15, y + 5, 90, 90);
                    }
                }

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 30px "IBMPlexSansArabic", "CustomFont", sans-serif';
                ctx.textAlign = 'left';
                let name = member.user.username;
                if (name.length > 15) name = name.substring(0, 12) + '..';
                ctx.fillText(name, x + 115, y + 45);
            }
        } catch (e) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px "IBMPlexSansArabic", "CustomFont", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('غير معروف', x + 115, y + 45);
        }

        ctx.textAlign = 'left';

        if (textIcon) ctx.drawImage(textIcon, x + 115, y + 58, 22, 22);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '18px "IBMPlexSansArabic", "CustomFont", sans-serif';
        ctx.fillText(`لفل ${userRecord.level || 0}`, x + 145, y + 75);

        if (voiceIcon) ctx.drawImage(voiceIcon, x + 230, y + 58, 22, 22);
        const voiceSecs = userRecord.voice_xp || 0;
        const h = Math.floor(voiceSecs / 3600);
        const m = Math.floor((voiceSecs % 3600) / 60);
        let timeStr = '';
        if (h > 0) timeStr += `${h}س `;
        timeStr += `${m}د`;
        ctx.fillText(`لفل ${userRecord.voice_level || 0} (${timeStr})`, x + 260, y + 75);

        let badgeBg = 'rgba(255, 255, 255, 0.05)';
        let badgeBorder = 'rgba(255, 255, 255, 0.1)';
        let badgeText = '#FFFFFF';
        if (rank === 1) { badgeBg = 'rgba(255, 215, 0, 0.15)'; badgeBorder = 'rgba(255, 215, 0, 0.5)'; badgeText = '#FFD700'; }
        else if (rank === 2) { badgeBg = 'rgba(192, 192, 192, 0.15)'; badgeBorder = 'rgba(192, 192, 192, 0.5)'; badgeText = '#C0C0C0'; }
        else if (rank === 3) { badgeBg = 'rgba(205, 127, 50, 0.15)'; badgeBorder = 'rgba(205, 127, 50, 0.5)'; badgeText = '#CD7F32'; }

        roundRect(ctx, x + cardWidth - 85, y + 25, 60, 50, 15);
        ctx.fillStyle = badgeBg;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = badgeBorder;
        ctx.stroke();

        ctx.fillStyle = badgeText;
        ctx.font = 'bold 22px "IBMPlexSansArabic", "CustomFont", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${rank}`, x + cardWidth - 55, y + 57);
    }

    for (let i = 0; i < mappedUsers.length; i++) {
        const col = Math.floor(i / 5);
        const row = i % 5;
        const xPos = col === 0 ? 50 : 670;
        const yPos = startY + (row * spacing);
        await drawUserCard(mappedUsers[i], xPos, yPos, i + 1);
    }

    if (requestingUserRank) {
        ctx.font = 'bold 26px "IBMPlexSansArabic", "CustomFont", sans-serif';
        ctx.fillStyle = '#AAAAAA';
        ctx.textAlign = 'center';
        ctx.fillText(`ترتيبك رقم #${requestingUserRank}`, canvas.width / 2, canvas.height - 20);
    }

    return canvas.toBuffer();
}

module.exports = { createRankCard, createLeaderboardCanvas };
