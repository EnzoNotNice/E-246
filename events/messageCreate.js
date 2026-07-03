const db = require('../database/db');

function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/i;

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const client = message.client;
    const guildId = message.guild.id;
    const userId = message.author.id;
    const channelId = message.channel.id;
    const prefix = db.getGuildSettings(guildId).prefix || '#';

    const replies = db.getAutoReplies(guildId);
    for (const r of replies) {
      if (message.content.toLowerCase().includes(r.trigger)) {
        message.reply({ content: r.response }).catch(() => null);
        break;
      }
    }

    const automations = db.getAutomation(guildId, channelId);
    const automationBatch = [];
    for (const a of automations) {
      if (a.type === 'images') {
        const hasImage = message.attachments.some(att => att.contentType?.startsWith('image/'));
        const hasImageLink = /\.(png|jpg|jpeg|gif|webp)$/i.test(message.content);
        if (!hasImage && !hasImageLink) {
          await message.delete().catch(() => null);
          const msg = await message.channel.send({ content: `${message.author}, هذا الروم للصور فقط` });
          setTimeout(() => msg.delete().catch(() => null), 5000);
          return;
        }
      }
      if (a.type === 'youtube') {
        if (!youtubeRegex.test(message.content)) {
          await message.delete().catch(() => null);
          const msg = await message.channel.send({ content: `${message.author}, هذا الروم لروابط يوتيوب فقط` });
          setTimeout(() => msg.delete().catch(() => null), 5000);
          return;
        }
      }
      if (a.type === 'line' && a.value) {
        message.channel.send({ content: a.value }).catch(() => null);
      }
      if (a.type === 'autoline') {
        const settings = db.getGuildSettings(guildId);
        if (settings.line_image) {
            message.channel.send({ content: settings.line_image }).catch(() => null);
        }
      }
      if (a.type === 'autotax') {
        let amountStr = message.content.toLowerCase().trim();
        let multiplier = 1;
        if (amountStr.endsWith('k')) multiplier = 1000;
        else if (amountStr.endsWith('m')) multiplier = 1000000;
        else if (amountStr.endsWith('b')) multiplier = 1000000000;

        const amount = parseFloat(amountStr.replace(/[^\d.]/g, '')) * multiplier;
        if (!isNaN(amount) && amount > 0) {
            const tax = Math.floor(amount * (20 / 19) + 1);
            message.reply({ content: `**${tax}**` }).catch(() => null);
        }
      }
      if (a.type === 'react' && a.value) {
        message.react(a.value).catch(() => null);
      }
    }

    const protection = db.getProtection(guildId);
    if (protection && protection.antilink) {
      const bypassRole = protection.bypass_role;
      const member = message.member;
      if (!bypassRole || !member.roles.cache.has(bypassRole)) {
        const linkRegex = /https?:\/\/[^\s]+/i;
        if (linkRegex.test(message.content)) {
          await message.delete().catch(() => null);
          const warnMsg = await message.channel.send({ content: `${message.author}, ممنوع إرسال الروابط هنا` });
          setTimeout(() => warnMsg.delete().catch(() => null), 5000);
          return;
        }
      }
    }

    const levelSettings = db.getLevelSettings(guildId);
    if (levelSettings.enabled) {
      const now = Math.floor(Date.now() / 1000);
      const userData = db.getLevel(userId, guildId);
      const cooldown = levelSettings.xp_cooldown || 60;

      if (!userData || (now - (userData.last_message || 0)) >= cooldown) {
        const xpGain = Math.floor(
          Math.random() * (levelSettings.xp_max - levelSettings.xp_min + 1) + levelSettings.xp_min
        );

        db.addXP(userId, guildId, xpGain);
        const { checkLevelUp } = require('../utils/levels');
        await checkLevelUp(client, userId, guildId, channelId);
      }
    }
  }
};
