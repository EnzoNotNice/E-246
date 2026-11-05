const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const logger = require('./logger');

try {
  const fontPath = path.join(__dirname, '../assets/fonts/IBMPlexSansArabic-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'IBMPlexSansArabic');
  const montPath = path.join(__dirname, '../assets/fonts/Montserrat-Bold.ttf');
  GlobalFonts.registerFromPath(montPath, 'Montserrat');
} catch (e) {
  logger.error('[ProfileCanvas] Failed to register fonts:', e.message);
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

/**
 * Generates a high-resolution canvas profile card matching E-246 Dark Matte Glassmorphism aesthetic.
 * @param {import('discord.js').GuildMember|import('discord.js').User} target
 * @param {Object} data
 * @param {number} data.credits
 * @param {number} data.rank
 * @param {number} data.level
 * @param {number} data.xp
 * @param {number} data.neededXp
 * @param {number} data.rep
 * @param {string} data.bio
 * @param {number} data.streak
 * @param {string} [data.status]
 * @param {Array<string>} [data.badges]
 * @returns {Promise<Buffer>}
 */
async function generateProfileCard(target, data = {}) {
  const width = 960;
  const height = 540;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const user = target.user || target;
  const member = target.guild ? target : null;

  const credits = data.credits || 0;
  const rank = data.rank || 1;
  const level = data.level || 0;
  const xp = data.xp || 0;
  const neededXp = Math.max(data.neededXp || 100, 1);
  const rep = data.rep || 0;
  const bio = data.bio || 'عضو مميز في السيرفر';
  const streak = data.streak || 0;

  // Determine Presence Status
  let statusColor = '#747f8d'; // offline
  const presenceStatus = member?.presence?.status || data.status || 'offline';
  if (presenceStatus === 'online') statusColor = '#3ba55d';
  else if (presenceStatus === 'idle') statusColor = '#faa81a';
  else if (presenceStatus === 'dnd') statusColor = '#ed4245';

  // 1. Base Outer Background - Dark Matte Canvas
  ctx.fillStyle = '#0a0b12';
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Glow Mesh (Glassmorphic lighting)
  // Radial glow top-left (Indigo/Electric blue)
  const glow1 = ctx.createRadialGradient(180, 140, 20, 180, 140, 360);
  glow1.addColorStop(0, 'rgba(88, 101, 242, 0.28)');
  glow1.addColorStop(0.6, 'rgba(88, 101, 242, 0.08)');
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  // Radial glow bottom-right (Neon violet)
  const glow2 = ctx.createRadialGradient(820, 420, 20, 820, 420, 340);
  glow2.addColorStop(0, 'rgba(140, 82, 255, 0.22)');
  glow2.addColorStop(0.7, 'rgba(235, 69, 158, 0.06)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // 3. Main Glass Card Container
  const cardX = 28;
  const cardY = 28;
  const cardW = width - 56;
  const cardH = height - 56;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 35;
  ctx.shadowOffsetY = 15;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fillStyle = 'rgba(17, 20, 32, 0.85)';
  ctx.fill();
  ctx.restore();

  // Glass Card Stroke
  const cardBorder = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardBorder.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  cardBorder.addColorStop(0.3, 'rgba(88, 101, 242, 0.3)');
  cardBorder.addColorStop(0.7, 'rgba(140, 82, 255, 0.2)');
  cardBorder.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = cardBorder;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.stroke();

  // 4. Header Banner Backdrop
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, 130, 24);
  ctx.clip();
  const bannerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 130);
  bannerGrad.addColorStop(0, '#1a1d30');
  bannerGrad.addColorStop(0.5, '#242045');
  bannerGrad.addColorStop(1, '#151726');
  ctx.fillStyle = bannerGrad;
  ctx.fillRect(cardX, cardY, cardW, 130);

  // Banner decorative lines / grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = cardX; x < cardX + cardW; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, cardY);
    ctx.lineTo(x + 60, cardY + 130);
    ctx.stroke();
  }
  ctx.restore();

  // 5. User Information & Avatar Setup
  const displayName = member?.displayName || user.globalName || user.username || 'User';
  const userTag =
    user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : `@${user.username || 'user'}`;

  const avatarSize = 130;
  const avatarX = cardX + 40;
  const avatarY = cardY + 65;

  // Avatar drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0b12';
  ctx.fill();
  ctx.restore();

  // Avatar Border Ring
  const ringGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
  ringGrad.addColorStop(0, '#5865F2');
  ringGrad.addColorStop(0.5, '#00D2FF');
  ringGrad.addColorStop(1, '#8C52FF');
  ctx.lineWidth = 4;
  ctx.strokeStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Dynamic Booster Halo Perk (Neon Magenta / Pink Radiant Aura)
  const isBoosterUser = Boolean(member?.premiumSince || data.isBooster);
  if (isBoosterUser) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 115, 250, 0.85)';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 7, 0, Math.PI * 2);
    const boosterHaloGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    boosterHaloGrad.addColorStop(0, '#ff73fa');
    boosterHaloGrad.addColorStop(0.5, '#eb459e');
    boosterHaloGrad.addColorStop(1, '#7289da');
    ctx.strokeStyle = boosterHaloGrad;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  // Load and Clip Avatar Image
  const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
  let avatarLoaded = false;
  if (avatarUrl) {
    try {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      avatarLoaded = true;
    } catch {
      avatarLoaded = false;
    }
  }

  if (!avatarLoaded) {
    // Default avatar gradient with user initial
    ctx.save();
    const avatarGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    avatarGrad.addColorStop(0, '#5865F2');
    avatarGrad.addColorStop(1, '#8C52FF');
    ctx.fillStyle = avatarGrad;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();

    const initial = (displayName || 'U')[0].toUpperCase();
    ctx.font = 'bold 54px Montserrat, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.restore();
  }

  // Status Dot
  const dotRadius = 13;
  const dotX = avatarX + avatarSize - 16;
  const dotY = avatarY + avatarSize - 16;

  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius + 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#111420';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();

  // 6. Username, Tag, and Title
  const textStartX = avatarX + avatarSize + 30;

  // Reset text baseline and alignment
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Display Name
  ctx.font = 'bold 30px IBMPlexSansArabic, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 8;
  ctx.fillText(displayName.slice(0, 22), textStartX, cardY + 105);
  ctx.shadowBlur = 0;

  // Tag / Handle
  ctx.font = '16px Montserrat, sans-serif';
  ctx.fillStyle = '#8e9297';
  ctx.fillText(userTag, textStartX, cardY + 130);

  // Bio / Title Box
  const bioX = textStartX;
  const bioY = cardY + 145;
  const bioW = cardW - (textStartX - cardX) - 35;
  const bioH = 42;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  roundRect(ctx, bioX, bioY, bioW, bioH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, bioX, bioY, bioW, bioH, 10);
  ctx.stroke();

  ctx.font = '15px IBMPlexSansArabic, sans-serif';
  ctx.fillStyle = '#b0b5c0';
  ctx.fillText(`“ ${bio.slice(0, 60)} ”`, bioX + 16, bioY + 26);

  // 7. Stat Cards Grid (4 Glass Panels)
  const statsY = cardY + 210;
  const statsH = 92;
  const statCardW = (cardW - 80) / 4;

  const statItems = [
    {
      label: 'الكريدت / CREDITS',
      value: `$${credits.toLocaleString()}`,
      color: '#FEE75C',
      icon: '💰'
    },
    {
      label: 'الرتبة / RANK',
      value: `#${rank}`,
      color: '#00D2FF',
      icon: '🏆'
    },
    {
      label: 'المستوى / LEVEL',
      value: `LVL ${level}`,
      color: '#5865F2',
      icon: '⚡'
    },
    {
      label: 'السمعة / REP',
      value: `+${rep}`,
      color: '#EB459E',
      icon: '⭐'
    }
  ];

  for (let i = 0; i < statItems.length; i++) {
    const item = statItems[i];
    const sX = cardX + 32 + i * (statCardW + 6);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, sX, statsY, statCardW, statsH, 14);
    ctx.fillStyle = 'rgba(22, 26, 42, 0.7)';
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, sX, statsY, statCardW, statsH, 14);
    ctx.stroke();

    // Top subtle color line accent
    ctx.fillStyle = item.color;
    roundRect(ctx, sX + 14, statsY + 6, statCardW - 28, 2.5, 2);
    ctx.fill();

    // Label
    ctx.font = 'bold 11px Montserrat, IBMPlexSansArabic, sans-serif';
    ctx.fillStyle = '#8c93a4';
    ctx.fillText(item.label, sX + 14, statsY + 34);

    // Value
    ctx.font = 'bold 22px Montserrat, IBMPlexSansArabic, sans-serif';
    ctx.fillStyle = item.color;
    ctx.fillText(item.value, sX + 14, statsY + 68);
  }

  // 8. XP Progress Bar Section
  const xpSectionY = statsY + statsH + 24;
  const barX = cardX + 32;
  const barW = cardW - 64;
  const barH = 22;

  // XP Text Row
  const progressRatio = Math.min(Math.max(xp / neededXp, 0), 1);
  const percentText = Math.floor(progressRatio * 100);

  ctx.font = 'bold 13px Montserrat, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('EXPERIENCE PROGRESS', barX, xpSectionY + 12);

  ctx.font = 'bold 13px Montserrat, sans-serif';
  ctx.fillStyle = '#a5b4fc';
  const xpNumbers = `${xp.toLocaleString()} / ${neededXp.toLocaleString()} XP (${percentText}%)`;
  const xpMetrics = ctx.measureText(xpNumbers);
  ctx.fillText(xpNumbers, barX + barW - xpMetrics.width, xpSectionY + 12);

  // Bar Background Track
  const barTrackY = xpSectionY + 22;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  roundRect(ctx, barX, barTrackY, barW, barH, barH / 2);
  ctx.fill();

  // Bar Fill Gradient
  if (progressRatio > 0.01) {
    const fillWidth = Math.max(barW * progressRatio, barH);
    const xpGrad = ctx.createLinearGradient(barX, barTrackY, barX + fillWidth, barTrackY);
    xpGrad.addColorStop(0, '#5865F2');
    xpGrad.addColorStop(0.5, '#8C52FF');
    xpGrad.addColorStop(1, '#00D2FF');

    ctx.save();
    ctx.shadowColor = 'rgba(88, 101, 242, 0.45)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = xpGrad;
    roundRect(ctx, barX, barTrackY, fillWidth, barH, barH / 2);
    ctx.fill();
    ctx.restore();
  }

  // 9. Badges Row
  const badgesY = barTrackY + barH + 22;
  const badgesList = [];

  const hasPerm = (perm) => {
    try {
      if (!member?.permissions?.has) return false;
      return member.permissions.has(perm);
    } catch {
      return false;
    }
  };

  // Determine badges dynamically
  if (member?.guild?.ownerId === user.id) {
    badgesList.push({ name: 'OWNER', color: '#FEE75C', bg: 'rgba(254, 231, 92, 0.15)', icon: '👑' });
  }
  if (hasPerm('Administrator')) {
    badgesList.push({ name: 'ADMIN', color: '#ED4245', bg: 'rgba(237, 66, 69, 0.15)', icon: '🛡️' });
  } else if (hasPerm('ModerateMembers') || hasPerm('ManageMessages')) {
    badgesList.push({ name: 'MODERATOR', color: '#5865F2', bg: 'rgba(88, 101, 242, 0.15)', icon: '⚡' });
  }

  if (member?.premiumSince || data.isBooster) {
    let boostBadgeName = 'BOOSTER';
    if (member?.premiumSince) {
      const msSince = Math.max(0, Date.now() - new Date(member.premiumSince).getTime());
      const months = Math.max(1, Math.floor(msSince / (1000 * 60 * 60 * 24 * 30.4375)));
      const milestones = [0, 1, 2, 3, 6, 9, 12, 15, 18, 24];
      let tier = 1;
      for (let i = 1; i < milestones.length; i++) {
        if (months >= milestones[i]) tier = i;
      }
      boostBadgeName = `BOOST LVL ${tier}`;
    }
    badgesList.push({ name: boostBadgeName, color: '#EB459E', bg: 'rgba(235, 69, 158, 0.22)', icon: '💖' });
  }

  if (rank <= 3) {
    badgesList.push({ name: 'TOP 3', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)', icon: '🥇' });
  } else if (rank <= 10) {
    badgesList.push({ name: 'TOP 10', color: '#00D2FF', bg: 'rgba(0, 210, 255, 0.15)', icon: '🌟' });
  }

  if (streak >= 7) {
    badgesList.push({ name: `STREAK ${streak}D`, color: '#FF7B00', bg: 'rgba(255, 123, 0, 0.15)', icon: '🔥' });
  }

  if (badgesList.length === 0) {
    badgesList.push({ name: 'MEMBER', color: '#57F287', bg: 'rgba(87, 242, 135, 0.15)', icon: '🎖️' });
  }

  // Draw Badges Pill Row
  let currentBadgeX = barX;
  for (const b of badgesList.slice(0, 5)) {
    ctx.font = 'bold 12px Montserrat, sans-serif';
    const textWidth = ctx.measureText(`${b.icon} ${b.name}`).width;
    const pillW = textWidth + 24;
    const pillH = 30;

    // Pill background
    ctx.fillStyle = b.bg;
    roundRect(ctx, currentBadgeX, badgesY, pillW, pillH, 15);
    ctx.fill();

    // Pill border
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1;
    roundRect(ctx, currentBadgeX, badgesY, pillW, pillH, 15);
    ctx.stroke();

    // Text
    ctx.fillStyle = b.color;
    ctx.fillText(`${b.icon} ${b.name}`, currentBadgeX + 12, badgesY + 19);

    currentBadgeX += pillW + 12;
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateProfileCard
};
