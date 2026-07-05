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
  const icon = emojis.circlecheck || '{emoji:circlecheck}';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function error(title, description) {
  const e = embed('error');
  const icon = emojis.circlex || '{emoji:circlex}';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function warn(title, description) {
  const e = embed('warning');
  const icon = emojis.alerttriangle || '{emoji:alerttriangle}';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function info(title, description) {
  const e = embed('info');
  const icon = emojis.infocircle || '{emoji:infocircle}';
  if (description) return e.setTitle(`${icon} ${title}`).setDescription(description);
  return e.setDescription(title);
}

function modlog(action, target, moderator, reason, extra = {}) {
  const eInfo = emojis.user || '{emoji:user}';
  const eShield = emojis.shield || '{emoji:shield}';
  const eList = emojis.list || '{emoji:list}';
  const eLock = emojis.shieldlock || '{emoji:shieldlock}';
  
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
