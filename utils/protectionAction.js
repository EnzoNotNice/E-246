const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { sendLog } = require('./logger');

const actionTracker = new Map();

function track(guildId, userId, type) {
  const key = `${guildId}_${userId}_${type}`;
  const now = Date.now();
  let times = actionTracker.get(key) || [];
  times = times.filter(t => now - t < 60000);
  times.push(now);
  actionTracker.set(key, times);
  return times.length;
}

async function punish(guild, executor, action, reason) {
  if (!executor || executor.id === guild.ownerId || executor.bot) return;
  if (db.isWhitelisted(guild.id, executor.id)) return;

  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member) return;

  if (action === 'ban') {
    await member.ban({ reason }).catch(() => null);
  } else if (action === 'kick') {
    await member.kick(reason).catch(() => null);
  } else if (action === 'timeout') {
    await member.timeout(28 * 24 * 60 * 60 * 1000, reason).catch(() => null);
  } else {
    await member.roles.set([], reason).catch(() => null);
  }
}

async function handleLimit(guild, executor, type, limitField, title) {
  if (!executor || executor.id === guild.client.user.id) return false;
  const prot = db.getProtection(guild.id);
  if (!prot || !prot.enabled) return false;
  if (executor.id === guild.ownerId || db.isWhitelisted(guild.id, executor.id)) return false;

  const limit = prot[limitField] || 3;
  const count = track(guild.id, executor.id, type);
  if (count <= limit) return false;

  await punish(guild, executor, prot.action || 'ban', `Protection: ${type} limit exceeded`);

  const embed = new EmbedBuilder()
    .setTitle(`{emoji:shield} ${title}`)
    .setColor(0xFF0000)
    .addFields(
      { name: '{emoji:user} الفاعل', value: `<@${executor.id}>`, inline: true },
      { name: '{emoji:alerttriangle} النوع', value: type, inline: true },
      { name: '{emoji:bolt} العدد', value: `${count}/${limit}`, inline: true },
      { name: '{emoji:shieldlock} الإجراء', value: prot.action || 'ban', inline: true }
    )
    .setTimestamp();

  await sendLog(guild.client, guild.id, embed, 'protection');
  return true;
}

module.exports = { handleLimit, punish, track };
