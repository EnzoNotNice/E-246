const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');
const db = require('../database/db');

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

async function recolorEmojis() {
  const settings = db.getBotSettings();
  const color = settings.emoji_color || 'blue';
  
  const originalDir = path.join(__dirname, '..', 'assets', 'emojis');
  const targetDir = path.join(originalDir, color);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const colorHues = {
    blue: 220,
    red: 0,
    green: 145,
    purple: 275,
    gold: 42,
    pink: 325
  };

  const targetHue = colorHues[color] !== undefined ? colorHues[color] : 220;
  const files = fs.readdirSync(originalDir);

  for (const file of files) {
    const ext = path.extname(file);
    if (ext !== '.png' && ext !== '.gif') continue;

    const sourcePath = path.join(originalDir, file);
    const targetPath = path.join(targetDir, file);



    const isBoostOrNitro = file.toLowerCase().includes('boost') || file.toLowerCase().includes('nitro');
    if (ext === '.gif' || color === 'purple' || isBoostOrNitro) {
      fs.copyFileSync(sourcePath, targetPath);
      continue;
    }

    try {
      const img = await Canvas.loadImage(sourcePath);
      const canvas = Canvas.createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const [h, s, l] = rgbToHsl(r, g, b);

        if (s > 10) {
          const [nr, ng, nb] = hslToRgb(targetHue, s, l);
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      fs.writeFileSync(targetPath, canvas.toBuffer());
    } catch (err) {
      console.error(`Failed to recolor emoji ${file}:`, err.message);
    }
  }
}

module.exports = recolorEmojis;
