const { EmbedBuilder } = require('discord.js');
const emojis = require('./emojis.json');

const colors = {
  success: 0x57F287,
  error: 0xED4245,
  warning: 0xFEE75C,
  info: 0x5865F2,
  primary: 0x5865F2,
  moderation: 0xFF6B6B,
  level: 0xFFD700,
  giveaway: 0xFF73FA,
  ticket: 0x00B0F4,
};

function embed(type = 'info') {
  return new EmbedBuilder().setColor(colors[type] || colors.info).setTimestamp();
}

function success(title, description) {
  const e = embed('success');
  const icon = emojis.circlecheck || '<:circlecheck:1519212246876557413>';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function error(title, description) {
  const e = embed('error');
  const icon = emojis.circlex || '<:circlex:1519212245559672914>';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function warn(title, description) {
  const e = embed('warning');
  const icon = emojis.alerttriangle || '<:alerttriangle:1519212253054767205>';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function info(title, description) {
  const e = embed('info');
  const icon = emojis.infocircle || '<:infocircle:1519212235258335324>';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function modlog(action, target, moderator, reason, extra = {}) {
  const eInfo = emojis.user || '<:user:1519212186633764995>';
  const eShield = emojis.shield || '<:shield:1519212202676977788>';
  const eList = emojis.list || '<:list:1519212232670580868>';
  const eLock = emojis.shieldlock || '<:shieldlock:1519212205638287522>';
  
  const e = embed('moderation')
    .setTitle(`${eLock} ${action}`)
    .addFields(
      { name: `${eInfo} العضو`, value: `${target.tag || target} (${target.id || 'غير متاح'})`, inline: true },
      { name: `${eShield} المشرف`, value: `${moderator.tag || moderator} (${moderator.id || 'غير متاح'})`, inline: true },
      { name: `${eList} السبب`, value: reason || 'لا يوجد سبب' }
    );
  for (const [k, v] of Object.entries(extra)) {
    e.addFields({ name: k, value: String(v), inline: true });
  }
  return e;
}

module.exports = { embed, success, error, warn, info, modlog, colors };
