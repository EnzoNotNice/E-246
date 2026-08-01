const { EmbedBuilder } = require('discord.js');
const emojis = require('./emojis.json');
const { logger } = require('./logger');

const colors = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  primary: 0x5865f2,
  moderation: 0xff6b6b,
  level: 0xffd700,
  giveaway: 0xff73fa,
  ticket: 0x00b0f4
};

function embed(type = 'info', guildId = null) {
  let color = colors[type] || colors.info;
  if (guildId && !['success', 'error', 'warning'].includes(type)) {
    try {
      const db = require('../database/db');
      const settings = db.getGuildSettings(guildId);
      if (settings && settings.embed_color) {
        color = settings.embed_color;
      }
    } catch (error) {
      // Ignore errors in fetching guild settings - not critical
      logger.debug('Could not get guild embed color setting:', error.message);
    }
  }
  return new EmbedBuilder().setColor(color).setTimestamp();
}

function formatText(str) {
  if (typeof str !== 'string') return str;

  const protectedItems = [];
  let result = str.replace(/<a?:\w+:\d+>/g, (match) => {
    protectedItems.push(match);
    return `___P${protectedItems.length - 1}___`;
  });

  result = result.replace(/<t:\d+:[a-zA-Z]>/g, (match) => {
    protectedItems.push(match);
    return `___P${protectedItems.length - 1}___`;
  });

  result = result.replace(/\{emoji:\w+\}/g, (match) => {
    protectedItems.push(match);
    return `___P${protectedItems.length - 1}___`;
  });

  result = result.replace(/___P(\d+)___/g, (_, index) => protectedItems[index]);

  return result;
}

function safeBold(str) {
  if (typeof str !== 'string') return str;
  if (str.includes('**')) return str;
  return `**${str}**`;
}

function success(title, description, guildId = null) {
  const e = embed('success', guildId);
  const icon = emojis.circlecheck || '{emoji:circlecheck}';
  if (description)
    return e.setTitle(formatText(`${icon} __${title}__`)).setDescription(formatText(safeBold(description)));
  return e.setDescription(formatText(safeBold(title)));
}

function error(title, description, guildId = null) {
  const e = embed('error', guildId);
  const icon = emojis.circlex || '{emoji:circlex}';
  if (description)
    return e.setTitle(formatText(`${icon} __${title}__`)).setDescription(formatText(safeBold(description)));
  return e.setDescription(formatText(safeBold(title)));
}

function warn(title, description, guildId = null) {
  const e = embed('warning', guildId);
  const icon = emojis.alerttriangle || '{emoji:alerttriangle}';
  if (description)
    return e.setTitle(formatText(`${icon} __${title}__`)).setDescription(formatText(safeBold(description)));
  return e.setDescription(formatText(safeBold(title)));
}

function info(title, description, guildId = null) {
  const e = embed('info', guildId);
  const icon = emojis.infocircle || '{emoji:infocircle}';
  if (description)
    return e.setTitle(formatText(`${icon} __${title}__`)).setDescription(formatText(safeBold(description)));
  return e.setDescription(formatText(safeBold(title)));
}

function modlog(action, target, moderator, reason, extra = {}, guildId = null) {
  const eInfo = emojis.user || '{emoji:user}';
  const eShield = emojis.shield || '{emoji:shield}';
  const eList = emojis.list || '{emoji:list}';
  const eLock = emojis.shieldlock || '{emoji:shieldlock}';

  const e = embed('moderation', guildId)
    .setTitle(formatText(`${eLock} __${action}__`))
    .addFields(
      {
        name: formatText(`${eInfo} __العضو__`),
        value: `**${target.tag || target}** ('${target.id || 'غير متاح'}')`,
        inline: true
      },
      {
        name: formatText(`${eShield} __المشرف__`),
        value: `**${moderator.tag || moderator}** ('${moderator.id || 'غير متاح'}')`,
        inline: true
      },
      { name: formatText(`${eList} __السبب__`), value: formatText(`'${reason || 'لا يوجد سبب'}'`) }
    );
  for (const [k, v] of Object.entries(extra)) {
    e.addFields({ name: formatText(`__${k}__`), value: formatText(`'${v}'`), inline: true });
  }
  return e;
}

module.exports = { embed, success, error, warn, info, modlog, colors };
