const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');


function parseDuration(str) {
  if (!str) return null;
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let total = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'd') total += val * 86400;
    else if (unit === 'h') total += val * 3600;
    else if (unit === 'm') total += val * 60;
    else if (unit === 's') total += val;
  }
  return total > 0 ? total : null;
}

function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d} يوم`);
  if (h) parts.push(`${h} ساعة`);
  if (m) parts.push(`${m} دقيقة`);
  if (s) parts.push(`${s} ثانية`);
  return parts.join(' ') || '0 ثانية';
}

async function endGiveawayTimer(client, giveaway) {
  try {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return db.endGiveaway(giveaway.messageId);

    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!message) return db.endGiveaway(giveaway.messageId);

    const reaction = message.reactions.cache.get(giveaway.emoji) || message.reactions.cache.first();
    if (!reaction) {
      db.endGiveaway(giveaway.messageId);
      return channel.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`<:confetti:1519212243026448394> الجيف أواي على **${giveaway.prize}** انتهى بدون مشاركين`)] });
    }

    const users = await reaction.users.fetch();
    const eligible = users.filter(u => !u.bot);

    if (!eligible.size) {
      db.endGiveaway(giveaway.messageId);
      return channel.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`<:confetti:1519212243026448394> الجيف أواي على **${giveaway.prize}** انتهى بدون مشاركين مؤهلين`)] });
    }

    const winnersCount = Math.min(giveaway.winners, eligible.size);
    const winners = eligible.random(winnersCount);
    const winnerMentions = (Array.isArray(winners) ? winners : [winners]).map(w => `<@${w.id}>`).join(', ');

    const endEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('<:confetti:1519212243026448394> انتهى الجيف أواي')
      .setDescription(`**الجائزة** ${giveaway.prize}\n**الفائز** ${winnerMentions}`)
      .setTimestamp();

    await message.edit({ embeds: [endEmbed], components: [] }).catch(() => null);
    await channel.send({ content: `<:confetti:1519212243026448394> مبروك ${winnerMentions} ربحت **${giveaway.prize}**`, embeds: [endEmbed] }).catch(() => null);
    db.endGiveaway(giveaway.messageId);
  } catch (e) {
    console.error('Giveaway end error:', e);
    db.endGiveaway(giveaway.messageId);
  }
}

module.exports = { parseDuration, formatDuration, endGiveawayTimer };
