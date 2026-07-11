const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'fonts', 'IBMPlexSansArabic-Bold.ttf'), 'IBMPlexSansArabic');
} catch (e) {
    console.log('[RouletteHelper] Failed to load custom font:', e.message);
}

const WHEEL_COLORS = [
    '#FF3366', '#33CCFF', '#33FF99', '#FF9933', '#9933FF', 
    '#FFCC33', '#FF3333', '#33FFFC', '#B5FF33', '#E033FF'
];

async function generateRouletteGif(players, winnerIndex) {
    const size = 800;
    const half = size / 2;
    const totalSlices = players.length;
    const sliceAngle = (2 * Math.PI) / totalSlices;
    const spins = 5;
    const centerOfWinner = winnerIndex * sliceAngle + (sliceAngle / 2);
    const finalRotation = (spins * 2 * Math.PI) - (Math.PI / 2) - centerOfWinner;

    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 22, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    const outerGrad = ctx.createLinearGradient(0, 0, size, size);
    outerGrad.addColorStop(0, '#FF3366');
    outerGrad.addColorStop(0.5, '#33CCFF');
    outerGrad.addColorStop(1, '#FF3366');
    ctx.strokeStyle = outerGrad;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(finalRotation);
    for (let s = 0; s < totalSlices; s++) {
        const startAngle = s * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, half - 28, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[s % WHEEL_COLORS.length];
        ctx.fill();
        ctx.save();
        ctx.rotate(startAngle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(half - 28, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 8;
        const displayName = players[s].name;
        let fontSize = 32;
        if (displayName.length > 16) fontSize = 18;
        else if (displayName.length > 12) fontSize = 24;
        ctx.font = `bold ${fontSize}px IBMPlexSansArabic`;
        ctx.fillText(displayName, half - 90, 0);
        ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, 2 * Math.PI);
    const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 68);
    centerGrad.addColorStop(0, '#2B2D31');
    centerGrad.addColorStop(1, '#111214');
    ctx.fillStyle = centerGrad;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(half, 18);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(26, 0);
    ctx.lineTo(0, 48);
    ctx.closePath();
    const ptrGrad = ctx.createLinearGradient(0, 0, 0, 48);
    ptrGrad.addColorStop(0, '#FF3366');
    ptrGrad.addColorStop(1, '#FFCC33');
    ctx.fillStyle = ptrGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    return canvas.toBuffer('image/png');
}

module.exports = { generateRouletteGif };
