const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const logger = require('./logger');

try {
  const fontPath = path.join(__dirname, '../assets/fonts/IBMPlexSansArabic-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'IBMPlexSansArabic');
} catch (e) {
  logger.error('[CaptchaCanvas] Failed to register font:', e.message);
}

/**
 * Generates an authentic ProBot distorted 4-5 digit captcha image card.
 * Dark Matte Glassmorphism styling matching E-246 design system.
 * @returns {Promise<{ code: string, buffer: Buffer }>}
 */
async function generateTransferCaptcha() {
  // Generate random 4 or 5 digit number
  const length = Math.random() > 0.5 ? 5 : 4;
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }

  const width = 340;
  const height = 130;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background - Deep Matte Slate / Glassmorphic gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0f111a');
  bgGrad.addColorStop(0.5, '#151826');
  bgGrad.addColorStop(1, '#0c0d14');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 4, 4, width - 8, height - 8, 16);
  ctx.fill();

  // Subtle Border
  ctx.lineWidth = 1.5;
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  borderGrad.addColorStop(0.5, 'rgba(88, 101, 242, 0.35)');
  borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
  ctx.strokeStyle = borderGrad;
  roundRect(ctx, 4, 4, width - 8, height - 8, 16);
  ctx.stroke();

  // Background Grid / Noise Dots
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${Math.floor(Math.random() * 200 + 55)}, ${Math.floor(
      Math.random() * 200 + 55
    )}, 255, ${Math.random() * 0.25 + 0.05})`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * (width - 20) + 10,
      Math.random() * (height - 20) + 10,
      Math.random() * 2 + 1,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Background Distorted Wave Lines
  const colors = [
    'rgba(88, 101, 242, 0.35)',
    'rgba(235, 69, 158, 0.35)',
    'rgba(87, 242, 135, 0.35)',
    'rgba(254, 231, 92, 0.35)',
    'rgba(255, 255, 255, 0.25)'
  ];

  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = Math.random() * 2 + 1;
    ctx.beginPath();
    const startY = Math.random() * height;
    ctx.moveTo(10, startY);
    ctx.bezierCurveTo(
      width * 0.3,
      Math.random() * height,
      width * 0.7,
      Math.random() * height,
      width - 10,
      Math.random() * height
    );
    ctx.stroke();
  }

  // Render Distorted Characters
  const charSpacing = (width - 60) / (code.length + 1);
  const startX = 35 + charSpacing / 2;

  const fontFamilies = ['IBMPlexSansArabic', 'sans-serif'];
  const textColors = ['#FFFFFF', '#5865F2', '#00D2FF', '#FEE75C', '#57F287', '#EB459E'];

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = startX + i * charSpacing;
    const y = height / 2 + (Math.random() * 16 - 8) + 12;
    const angle = (Math.random() * 44 - 22) * (Math.PI / 180);
    const fontSize = Math.floor(Math.random() * 12 + 38);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.font = `bold ${fontSize}px ${fontFamilies[0]}`;
    ctx.fillStyle = textColors[Math.floor(Math.random() * textColors.length)];
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 0, 0);

    ctx.restore();
  }

  // Foreground Scratch Lines
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = colors[(i + 2) % colors.length];
    ctx.lineWidth = Math.random() * 1.5 + 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 40 + 10, Math.random() * height);
    ctx.lineTo(width - Math.random() * 40 - 10, Math.random() * height);
    ctx.stroke();
  }

  const buffer = await canvas.encode('png');
  return { code, buffer };
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

module.exports = {
  generateTransferCaptcha
};
