const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');


try {
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Montserrat-Bold.ttf'), 'Montserrat');
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/IBMPlexSansArabic-Bold.ttf'), 'IBMPlexSansArabic');
} catch (err) {
  console.error('[CanvasHelper] Failed to register font:', err.message);
}



function resolveImagePath(url) {
  if (!url) return null;
  const isRemote = url.startsWith('http://') || url.startsWith('https://');
  return isRemote ? url : path.resolve(url);
}

function clipRoundedRect(ctx, x, y, width, height, radius) {
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
  ctx.clip();
}


function drawRoundedRectPath(ctx, x, y, width, height, radius) {
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


function drawRoundedRect(ctx, x, y, width, height, radius, fillColor) {
  ctx.save();
  drawRoundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.restore();
}


async function generateShowcaseCard(avatarUrl, bannerUrl, username = 'Discord User') {
  const width = 1600;
  const height = 1000;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  
  ctx.save();
  clipRoundedRect(ctx, 0, 0, width, height, 40);

  
  ctx.fillStyle = '#18191c'; 
  ctx.fillRect(0, 0, width, height);

  
  if (bannerUrl) {
    try {
      const bannerImg = await loadImage(resolveImagePath(bannerUrl));
      
      
      const bannerRatio = bannerImg.width / bannerImg.height;
      const targetRatio = width / 520;
      
      let sWidth, sHeight, sx, sy;
      if (bannerRatio > targetRatio) {
        
        sHeight = bannerImg.height;
        sWidth = bannerImg.height * targetRatio;
        sx = (bannerImg.width - sWidth) / 2;
        sy = 0;
      } else {
        
        sWidth = bannerImg.width;
        sHeight = bannerImg.width / targetRatio;
        sx = 0;
        sy = (bannerImg.height - sHeight) / 2;
      }

      ctx.drawImage(bannerImg, sx, sy, sWidth, sHeight, 0, 0, width, 520);
    } catch (err) {
      console.error('[CanvasHelper] Failed to load banner image, falling back to gradient:', err.message);
      drawFallbackGradient(ctx, width, 520);
    }
  } else {
    
    drawFallbackGradient(ctx, width, 520);
  }

  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(0, 0, width, 520);

  
  const avatarCenterX = 260;
  const avatarCenterY = 520;
  const outerRadius = 180; 
  const innerRadius = 160; 

  
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#18191c';
  ctx.fill();

  
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, innerRadius, 0, Math.PI * 2);
  ctx.clip(); 

  if (avatarUrl) {
    try {
      const avatarImg = await loadImage(resolveImagePath(avatarUrl));
      
      ctx.drawImage(avatarImg, avatarCenterX - innerRadius, avatarCenterY - innerRadius, innerRadius * 2, innerRadius * 2);
    } catch (err) {
      console.error('[CanvasHelper] Failed to load avatar image, drawing default:', err.message);
      drawAvatarFallback(ctx, avatarCenterX, avatarCenterY, innerRadius, username);
    }
  } else {
    drawAvatarFallback(ctx, avatarCenterX, avatarCenterY, innerRadius, username);
  }
  ctx.restore();

  
  const containerX = 480;
  const containerY = 560; 
  const badgeSize = 48; 
  const badgeSpacing = 16;
  const padding = 12;
  
  const badgeFiles = [
    'assets/badges/nitro/opal.png',
    'assets/badges/boost/discordboost9.svg',
    'assets/badges/discordstaff.svg',
    'assets/badges/discordpartner.svg',
    'assets/badges/hypesquadbrilliance.svg',
    'assets/badges/discordbughunter2.svg',
    'assets/badges/discordearlysupporter.svg',
    'assets/badges/discordbotdev.svg'
  ];

  const containerWidth = (padding * 2) + (badgeFiles.length * badgeSize) + ((badgeFiles.length - 1) * badgeSpacing); 
  const containerHeight = (padding * 2) + badgeSize; 

  
  drawRoundedRect(ctx, containerX, containerY, containerWidth, containerHeight, 16, '#111214');

  
  let currentBadgeX = containerX + padding;
  const currentBadgeY = containerY + padding;

  for (const file of badgeFiles) {
    try {
      const badgeImg = await loadImage(path.resolve(file));
      ctx.drawImage(badgeImg, currentBadgeX, currentBadgeY, badgeSize, badgeSize);
      currentBadgeX += badgeSize + badgeSpacing;
    } catch (err) {
      console.error(`[CanvasHelper] Failed to load badge ${file}:`, err.message);
    }
  }

  


  
  ctx.restore();

  return canvas.toBuffer('image/png');
}


const NITRO_BADGES = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'ruby', 'opal'];
const NITRO_TIER_COLORS = {
  none:     { from: '#4f545c', to: '#36393f', glow: 'rgba(128,128,128,0.1)' },
  bronze:   { from: '#cd7f32', to: '#a0522d', glow: 'rgba(205,127,50,0.5)' },
  silver:   { from: '#c0c0c0', to: '#808080', glow: 'rgba(192,192,192,0.5)' },
  gold:     { from: '#ffd700', to: '#b8860b', glow: 'rgba(255,215,0,0.5)' },
  platinum: { from: '#e5e4e2', to: '#9e9e9e', glow: 'rgba(229,228,226,0.5)' },
  diamond:  { from: '#b9f2ff', to: '#00bfff', glow: 'rgba(185,242,255,0.5)' },
  emerald:  { from: '#50c878', to: '#006400', glow: 'rgba(80,200,120,0.5)' },
  ruby:     { from: '#ff3366', to: '#8b0000', glow: 'rgba(255,51,102,0.5)' },
  opal:     { from: '#ff9de2', to: '#8338ec', glow: 'rgba(255,157,226,0.5)' },
};


function formatTimeRemaining(ms) {
  if (ms <= 0) return '0d 0h 0m';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  
  return parts.join(' ');
}


async function generateNitroCard(nitroData, avatarUrl) {
  const scale = 2; 
  const W = 1200, H = 500;
  const canvas = createCanvas(W * scale, H * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const tier = nitroData.currentTier || 'bronze';
  const colors = NITRO_TIER_COLORS[tier] || NITRO_TIER_COLORS.bronze;

  
  const allBadges = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'ruby', 'opal'];
  const earnedSet = new Set((nitroData.earnedTiers || []).map(t => t.badge));
  const badgeSize = 100;
  const badgeGap = 32;
  const totalBadgeW = allBadges.length * badgeSize + (allBadges.length - 1) * badgeGap;
  const badgeStartX = (W - totalBadgeW) / 2;
  const badgeY = 110;

  const tierIndex = allBadges.indexOf(tier);
  let glowX = W / 2;
  let glowY = badgeY + badgeSize / 2;
  if (tierIndex !== -1) {
    glowX = badgeStartX + tierIndex * (badgeSize + badgeGap) + badgeSize / 2;
  }

  
  ctx.save();
  clipRoundedRect(ctx, 0, 0, W, H, 40);

  ctx.fillStyle = '#0c0c10';
  ctx.fillRect(0, 0, W, H);

  
  const bgGlow = ctx.createRadialGradient(glowX, glowY, 20, glowX, glowY, 600);
  bgGlow.addColorStop(0, colors.glow.replace('0.5)', '0.22)'));
  bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);

  
  const topStrip = ctx.createLinearGradient(0, 0, W, 0);
  topStrip.addColorStop(0, colors.glow.replace('0.5)', '0.0)'));
  topStrip.addColorStop(0.5, colors.glow.replace('0.5)', '0.18)'));
  topStrip.addColorStop(1, colors.glow.replace('0.5)', '0.0)'));
  ctx.fillStyle = topStrip;
  ctx.fillRect(0, 0, W, 4);

  
  const panelX = 50, panelY = 50, panelW = 1100, panelH = 400, panelR = 24;
  ctx.save();
  drawRoundedRectPath(ctx, panelX, panelY, panelW, panelH, panelR);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  

  for (let i = 0; i < allBadges.length; i++) {
    const name = allBadges[i];
    const bx = badgeStartX + i * (badgeSize + badgeGap);
    const isCurrentTier = name === tier;
    const isEarned = earnedSet.has(name);

    try {
      const badgeImg = await loadImage(path.resolve(`assets/badges/nitro/${name}.png`));

      if (isCurrentTier) {
        
        ctx.save();
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 48;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.shadowBlur = 28;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.restore();
      } else if (isEarned) {
        ctx.globalAlpha = 0.65;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.globalAlpha = 1;
      } else {
        
        ctx.globalAlpha = 0.15;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.globalAlpha = 1;
      }
    } catch {  }
  }

  
  const barX = 100, barY = 265, barW = 1000, barH = 32, barR = 16;
  
  let filledW = barR * 2;
  if (nitroData.hasNitro && tierIndex !== -1) {
    const currentBadgeX = badgeStartX + tierIndex * (badgeSize + badgeGap);
    filledW = Math.max(barR * 2, (currentBadgeX + badgeSize / 2) - barX);
  }

  
  drawRoundedRect(ctx, barX, barY, barW, barH, barR, 'rgba(255,255,255,0.08)');

  
  ctx.save();
  clipRoundedRect(ctx, barX, barY, filledW, barH, barR);
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0, colors.from);
  barGrad.addColorStop(1, colors.to);
  ctx.fillStyle = barGrad;
  ctx.fillRect(barX, barY, filledW, barH);
  
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(barX, barY, filledW, barH / 2);
  ctx.restore();

  
  if (nitroData.hasNitro && tierIndex !== -1) {
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(barX + filledW, barY + barH / 2, barH / 2 + 2, 0, Math.PI * 2);
    const dotGrad = ctx.createRadialGradient(barX + filledW, barY + barH / 2, 0, barX + filledW, barY + barH / 2, barH / 2 + 2);
    dotGrad.addColorStop(0, '#ffffff');
    dotGrad.addColorStop(1, colors.from);
    ctx.fillStyle = dotGrad;
    ctx.fill();
    ctx.restore();
  }

  
  const labelY = 315;
  ctx.font = 'bold 22px IBMPlexSansArabic';
  ctx.textBaseline = 'top';

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'left';
  const monthsLabel = nitroData.totalMonths != null
    ? `${nitroData.totalMonths} / ${nitroData.progressEnd} أشهر`
    : `✦ نيترو نشط`;
  ctx.fillText(monthsLabel, barX, labelY);

  if (nitroData.nextTier) {
    const nextLabel = nitroData.nextTier.charAt(0).toUpperCase() + nitroData.nextTier.slice(1);
    ctx.textAlign = 'right';
    const nextColors = NITRO_TIER_COLORS[nitroData.nextTier] || NITRO_TIER_COLORS.bronze;
    const textGrad = ctx.createLinearGradient(barX + barW - 200, 0, barX + barW, 0);
    textGrad.addColorStop(0, nextColors.from);
    textGrad.addColorStop(1, nextColors.to);
    ctx.fillStyle = textGrad;
    ctx.fillText(`→ ${nextLabel}`, barX + barW, labelY);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.from;
    ctx.fillText('أعلى مستوى 🎉', barX + barW, labelY);
  }

  
  const daysY = 365;
  ctx.font = 'bold 20px IBMPlexSansArabic';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let daysText = '';
  if (nitroData.timeRemainingMs != null) {
    daysText = `متبقي ${formatTimeRemaining(nitroData.timeRemainingMs)} للشارة القادمة`;
    ctx.fillStyle = '#ff73fa'; 
  } else if (nitroData.daysRemaining != null) {
    daysText = `متبقي حوالي ${nitroData.daysRemaining} يوم للشارة القادمة`;
    ctx.fillStyle = '#ff73fa';
  } else if (!nitroData.hasNitro) {
    daysText = `ليس لديك اشتراك نيترو`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
  } else {
    daysText = `✦ بطاقة تطور الشارات ✦`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
  }
  ctx.fillText(daysText, W / 2, daysY);

  


  
  if (!nitroData.hasNitro) {
    ctx.save();
    clipRoundedRect(ctx, 0, 0, W, H, 40);
    ctx.fillStyle = 'rgba(30, 30, 32, 0.95)'; 
    ctx.fillRect(0, 0, W, H);
    
    ctx.font = 'bold 46px IBMPlexSansArabic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ليس لديك اشتراك نيترو', W / 2, H / 2);
    ctx.restore();
  }

  ctx.restore();
  return canvas.toBuffer('image/png');
}


async function generateBoostCard(boostData, avatarUrl) {
  const scale = 2; 
  const W = 1200, H = 500;
  const canvas = createCanvas(W * scale, H * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const colors = {
    from: '#ff73fa',
    to: '#7289da',
    glow: 'rgba(255,115,250,0.45)',
  };
  const currentTier = boostData.badgeTier ?? 0;

  
  const badgeCount = 9;
  const badgeSize = 100;
  const badgeGap = 16;
  const totalBadgeW = badgeCount * badgeSize + (badgeCount - 1) * badgeGap;
  const badgeStartX = (W - totalBadgeW) / 2;
  const badgeY = 110;

  let glowX = W / 2;
  let glowY = badgeY + badgeSize / 2;
  if (currentTier >= 1 && currentTier <= badgeCount) {
    glowX = badgeStartX + (currentTier - 1) * (badgeSize + badgeGap) + badgeSize / 2;
  }

  
  ctx.save();
  clipRoundedRect(ctx, 0, 0, W, H, 40);

  ctx.fillStyle = '#0d0b14';
  ctx.fillRect(0, 0, W, H);

  
  const bgGlow = ctx.createRadialGradient(glowX, glowY, 20, glowX, glowY, 600);
  bgGlow.addColorStop(0, 'rgba(114,137,218,0.18)');
  bgGlow.addColorStop(0.5, 'rgba(255,115,250,0.10)');
  bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);

  
  const topStrip = ctx.createLinearGradient(0, 0, W, 0);
  topStrip.addColorStop(0, 'rgba(255,115,250,0)');
  topStrip.addColorStop(0.5, 'rgba(255,115,250,0.35)');
  topStrip.addColorStop(1, 'rgba(255,115,250,0)');
  ctx.fillStyle = topStrip;
  ctx.fillRect(0, 0, W, 4);

  
  const panelX = 50, panelY = 50, panelW = 1100, panelH = 400, panelR = 24;
  ctx.save();
  drawRoundedRectPath(ctx, panelX, panelY, panelW, panelH, panelR);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  

  for (let t = 1; t <= badgeCount; t++) {
    const bx = badgeStartX + (t - 1) * (badgeSize + badgeGap);
    const isCurrentTier = t === currentTier;
    const isEarned = t < currentTier;

    try {
      const badgeImg = await loadImage(path.resolve(`assets/badges/boost/discordboost${t}.svg`));

      if (isCurrentTier) {
        ctx.save();
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 50;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.shadowBlur = 28;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.restore();
      } else if (isEarned) {
        ctx.globalAlpha = 0.60;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.13;
        ctx.drawImage(badgeImg, bx, badgeY, badgeSize, badgeSize);
        ctx.globalAlpha = 1;
      }
    } catch {  }
  }

  
  const barX = 100, barY = 265, barW = 1000, barH = 32, barR = 16;
  
  let filledW = barR * 2;
  const hasAnyBoost = (boostData.boostMonths > 0 || boostData.hasBoost);
  if (hasAnyBoost && currentTier >= 1 && currentTier <= badgeCount) {
    const currentBadgeX = badgeStartX + (currentTier - 1) * (badgeSize + badgeGap);
    filledW = Math.max(barR * 2, (currentBadgeX + badgeSize / 2) - barX);
  }

  drawRoundedRect(ctx, barX, barY, barW, barH, barR, 'rgba(255,255,255,0.08)');

  ctx.save();
  clipRoundedRect(ctx, barX, barY, filledW, barH, barR);
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0, colors.from);
  barGrad.addColorStop(1, colors.to);
  ctx.fillStyle = barGrad;
  ctx.fillRect(barX, barY, filledW, barH);
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(barX, barY, filledW, barH / 2);
  ctx.restore();

  
  if (hasAnyBoost && currentTier >= 1 && currentTier <= badgeCount) {
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(barX + filledW, barY + barH / 2, barH / 2 + 2, 0, Math.PI * 2);
    const dotGrad = ctx.createRadialGradient(barX + filledW, barY + barH / 2, 0, barX + filledW, barY + barH / 2, barH / 2 + 2);
    dotGrad.addColorStop(0, '#ffffff');
    dotGrad.addColorStop(1, colors.from);
    ctx.fillStyle = dotGrad;
    ctx.fill();
    ctx.restore();
  }

  
  const labelY = 315;
  const monthsTier = [1, 2, 3, 6, 9, 12, 15, 18, 24];
  const nextMilestone = monthsTier.find(m => m > boostData.boostMonths);

  ctx.font = 'bold 22px IBMPlexSansArabic';
  ctx.textBaseline = 'top';

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'left';
  ctx.fillText(`${boostData.boostMonths} / ${nextMilestone ?? 24} أشهر`, barX, labelY);

  ctx.textAlign = 'right';
  if (nextMilestone != null) {
    const nextTierNum = Math.min(currentTier + 1, 9);
    const textGrad = ctx.createLinearGradient(barX + barW - 250, 0, barX + barW, 0);
    textGrad.addColorStop(0, colors.from);
    textGrad.addColorStop(1, colors.to);
    ctx.fillStyle = textGrad;
    ctx.fillText(`مستوى البوست ${nextTierNum} ←`, barX + barW, labelY);
  } else {
    ctx.fillStyle = colors.from;
    ctx.fillText('مستوى أسطوري 🏆', barX + barW, labelY);
  }

  
  const daysY = 365;
  ctx.font = 'bold 20px IBMPlexSansArabic';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let daysText = '';
  if (boostData.timeRemainingMs != null) {
    daysText = `${formatTimeRemaining(boostData.timeRemainingMs)} remaining to next badge`;
    ctx.fillStyle = '#ff73fa'; 
  } else if (boostData.daysRemaining != null) {
    daysText = `Approximately ${boostData.daysRemaining} days remaining to next badge`;
    ctx.fillStyle = '#ff73fa';
  } else if (boostData.boostMonths != null && nextMilestone != null) {
    
    const estDays = Math.max(0, Math.ceil((nextMilestone - boostData.boostMonths) * 30.44));
    daysText = `Approximately ${estDays} days remaining to next badge`;
    ctx.fillStyle = '#ff73fa';
  } else if (!hasAnyBoost) {
    daysText = `You do not have Server Boosts`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
  } else {
    daysText = `✦ Server Boosting Level Maximum ✦`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
  }
  ctx.fillText(daysText, W / 2, daysY);

  


  
  if (!hasAnyBoost) {
    ctx.save();
    clipRoundedRect(ctx, 0, 0, W, H, 40);
    ctx.fillStyle = 'rgba(30, 30, 32, 0.95)'; 
    ctx.fillRect(0, 0, W, H);
    
    ctx.font = 'bold 46px IBMPlexSansArabic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ليس لديك بوستات في هذا السيرفر', W / 2, H / 2);
    ctx.restore();
  }

  ctx.restore();
  return canvas.toBuffer('image/png');
}


function drawFallbackGradient(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#3f2b96');
  gradient.addColorStop(1, '#a8c0ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}


function drawAvatarFallback(ctx, x, y, radius, username) {
  ctx.fillStyle = '#5865f2';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(radius * 0.8)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const initials = (username || 'Discord User').trim().substring(0, 2).toUpperCase();
  ctx.fillText(initials, x, y);
}

async function generateTempVCPanel() {
  const width = 1200;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.save();
  clipRoundedRect(ctx, 0, 0, width, height, 30);
  ctx.fillStyle = '#111214'; // Very dark classic Discord color
  ctx.fillRect(0, 0, width, height);

  // Subtle Header line
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(0, 0, width, 140);
  
  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px IBMPlexSansArabic';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('لوحة تحكم الروم الصوتي', width / 2, 70);

  // Border below header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(0, 140, width, 2);

  const padding = 60;
  const startY = 220;
  const rowHeight = 130;

  const buttons = [
    { name: 'قفل الروم', icon: 'lock.png', desc: 'يمنع دخول أشخاص جدد للروم' },
    { name: 'فتح الروم', icon: 'unlock.png', desc: 'يسمح للجميع بالدخول مرة أخرى' },
    { name: 'إخفاء الروم', icon: 'hide.png', desc: 'يجعل الروم مخفي عن الجميع' },
    { name: 'إظهار الروم', icon: 'unhide.png', desc: 'يجعل الروم مرئي للجميع' },
    { name: 'تحديد العدد', icon: 'limit.png', desc: 'لتحديد أقصى عدد للأشخاص داخل الروم' },
    { name: 'تغيير الاسم', icon: 'rename.png', desc: 'يغير اسم الروم الصوتي الخاص بك' },
    { name: 'نقل الملكية', icon: 'transfer.png', desc: 'ينقل ملكية الروم وشريط التحكم لعضو آخر' },
    { name: 'طرد عضو', icon: 'kick.png', desc: 'يفصل شخص معين من رومك الصوتي' }
  ];

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  for (let i = 0; i < buttons.length; i++) {
    const col = Math.floor(i / 4);
    const row = i % 4;
    
    const x = width - padding - (col * (width / 2 - 40));
    const y = startY + (row * rowHeight);

    // Draw Icon Box (Sleek dark theme)
    drawRoundedRect(ctx, x - 80, y, 80, 80, 16, '#1e1f22');
    
    try {
      const iconImg = await loadImage(path.join(__dirname, '..', 'assets', 'tabler_icons', buttons[i].icon));
      ctx.drawImage(iconImg, x - 64, y + 16, 48, 48);
    } catch (e) {
      console.error('Failed to load icon:', buttons[i].icon);
    }

    // Text Box
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f2f3f5';
    ctx.font = 'bold 32px IBMPlexSansArabic';
    ctx.fillText(buttons[i].name, x - 100, y + 10);

    ctx.fillStyle = '#b5bac1';
    ctx.font = 'bold 20px IBMPlexSansArabic';
    ctx.fillText(buttons[i].desc, x - 100, y + 50);
  }

  ctx.restore();
  return canvas.toBuffer('image/png');
}



module.exports = { generateShowcaseCard, generateNitroCard, generateBoostCard, generateTempVCPanel };