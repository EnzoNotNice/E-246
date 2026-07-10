const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');


try {
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/IBMPlexSansArabic-Bold.ttf'), 'IBMPlexSansArabic');
} catch (e) {}

async function generateTVControlPanel() {
  const canvas = createCanvas(800, 700);
  const ctx = canvas.getContext('2d');

  
  ctx.fillStyle = '#2B2D31'; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  
  ctx.strokeStyle = '#1E1F22';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 45px IBMPlexSansArabic';
  ctx.textAlign = 'center';
  ctx.fillText('لوحة تحكم الغرفة الصوتية', canvas.width / 2, 70);
  
  
  ctx.fillStyle = '#5865F2';
  ctx.fillRect(canvas.width / 2 - 100, 90, 200, 4);

  const icons = [
    { file: 'tv_lock.png', desc: 'قفل الغرفة ومنع دخول المجهولين' },
    { file: 'tv_unlock.png', desc: 'فتح الغرفة والسماح للجميع بالدخول' },
    { file: 'tv_hide.png', desc: 'إخفاء الغرفة عن الأعضاء الآخرين' },
    { file: 'tv_show.png', desc: 'إظهار الغرفة وجعلها مرئية للجميع' },
    { file: 'tv_limit.png', desc: 'تحديد الحد الأقصى للمتواجدين' },
    { file: 'tv_rename.png', desc: 'تغيير اسم الغرفة الصوتية' },
    { file: 'tv_kick.png', desc: 'طرد عضو محدد من غرفتك' },
    { file: 'tv_trust.png', desc: 'إضافة مسؤول مساعد للتحكم بالروم' },
    { file: 'tv_ban.png', desc: 'حظر عضو من دخول غرفتك الصوتية' }
  ];

  let startY = 140;
  const padding = 55;
  
  ctx.textAlign = 'right';

  for (const item of icons) {
    
    const iconPath = path.join(__dirname, '..', 'assets', 'emojis', item.file);
    if (fs.existsSync(iconPath)) {
        const img = await loadImage(iconPath);
        
        ctx.drawImage(img, canvas.width - 100, startY - 33, 40, 40);
    }
    
    
    ctx.fillStyle = '#B5BAC1';
    ctx.font = '26px IBMPlexSansArabic';
    ctx.fillText(item.desc, canvas.width - 130, startY);
    
    startY += padding;
  }

  
  ctx.fillStyle = '#5865F2';
  ctx.fillRect(0, canvas.height - 15, canvas.width, 15);

  return canvas.encode('png');
}

module.exports = { generateTVControlPanel };
