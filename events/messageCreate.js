const db = require('../database/db');

function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/i;
const spamTracker = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    db.saveMessage(
      message.id,
      message.channel.id,
      message.guild.id,
      message.author.id,
      message.author.tag,
      message.author.displayAvatarURL(),
      message.content,
      message.attachments.map(att => att.url)
    );

    const client = message.client;
    const guildId = message.guild.id;
    const userId = message.author.id;
    const channelId = message.channel.id;
    const prefix = db.getGuildSettings(guildId).prefix || '#';

    let isCommand = false;
    let commandName = null;
    let args = [];
    let resolvedAlias = null;

    const customAliases = db.getAliases(guildId) || [];
    const normalizeShort = (s) => {
      let short = String(s || '');
      if (short.startsWith(prefix)) short = short.slice(prefix.length);
      return short.toLowerCase();
    };

    if (message.content.startsWith(prefix)) {
      args = message.content.slice(prefix.length).trim().split(/ +/).filter(Boolean);
      commandName = (args.shift() || '').toLowerCase();
      isCommand = !!commandName;
    } else {
      const content = message.content.trim();
      const contentLower = content.toLowerCase();
      const matched = customAliases
        .map((a) => ({ alias: a, short: normalizeShort(a.shortcut) }))
        .filter((x) => x.short)
        .sort((a, b) => b.short.length - a.short.length)
        .find((x) => contentLower === x.short || contentLower.startsWith(x.short + ' '));

      if (matched) {
        resolvedAlias = matched.alias;
        commandName = matched.short;
        const rest = contentLower === matched.short ? '' : content.slice(matched.short.length).trim();
        args = rest ? rest.split(/ +/).filter(Boolean) : [];
        isCommand = true;
      }
    }

    if (isCommand && commandName) {
      const { buildCommandHelpEmbed, shouldShowCommandHelp } = require('../utils/commandHelp');
      const { createFakeInteraction } = require('../utils/fakeInteraction');

      async function runSlash(slashCmd, runArgs) {
        const requiredPerms = slashCmd.data?.defaultMemberPermissions;
        if (requiredPerms && message.member && !message.member.permissions.has(requiredPerms)) {
          return message.reply({ content: '{emoji:circlex} ليس لديك صلاحية استخدام هذا الأمر.' }).catch(() => null);
        }
        if (shouldShowCommandHelp(slashCmd, runArgs)) {
          return message.reply({ embeds: [buildCommandHelpEmbed(slashCmd, guildId, prefix)] }).catch(() => null);
        }
        const fakeInteraction = await createFakeInteraction(message, slashCmd, runArgs);
        try {
          await slashCmd.execute(fakeInteraction);
        } catch (e) {
          console.error(e);
          if (!fakeInteraction.replied && !fakeInteraction.deferred) {
            await message.reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ الأمر.' }).catch(() => null);
          } else {
            await fakeInteraction.editReply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ الأمر.' }).catch(() => null);
          }
        }
      }

      let cmd = client.prefixCommands.get(commandName) || client.prefixCommands.find(c => c.aliases && c.aliases.includes(commandName));
      if (cmd) {
        try {
          await cmd.execute(message, args);
        } catch (e) {
          console.error(e);
        }
        return;
      }

      let slashCmd = client.commands.get(commandName);
      let runArgs = args;

      if (!slashCmd) {
        const alias =
          resolvedAlias ||
          customAliases.find((a) => normalizeShort(a.shortcut) === commandName);
        if (alias) {
          const aliasParts = String(alias.command || '').replace(/^\//, '').trim().split(/ +/).filter(Boolean);
          const mappedName = (aliasParts.shift() || '').toLowerCase();
          slashCmd = client.commands.get(mappedName);
          runArgs = [...aliasParts, ...args];
        }
      }

      if (slashCmd) {
        await runSlash(slashCmd, runArgs);
        return;
      }
    }

    if ([8, 9, 10, 11].includes(message.type)) {
      const settings = db.getGuildSettings(guildId);
      if (settings.autoboost_channel && settings.autoboost_message) {
        const boostChannel = message.guild.channels.cache.get(settings.autoboost_channel);
        if (boostChannel) {
          const msg = settings.autoboost_message.replace(/{user}/g, `<@${message.author.id}>`);
          boostChannel.send(msg).catch(() => null);
        }
      }
    }

    db.incrementHourlyMessages(guildId);

    const replies = db.getAutoReplies(guildId);
    const contentLower = message.content.toLowerCase();
    for (const r of replies) {
      const trigger = String(r.trigger || '').toLowerCase();
      if (trigger && contentLower.includes(trigger)) {
        message.reply({ content: r.response }).catch(() => null);
        if (r.deleteTrigger) {
          setTimeout(() => {
            message.delete().catch(() => null);
          }, 1000);
        }
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
            message.reply({ content: `{emoji:ProBot} **${tax}**` }).catch(() => null);
        }
      }
      if (a.type === 'react' && a.value) {
        message.react(a.value).catch(() => null);
      }
    }

    const protection = db.getProtection(guildId);
    if (protection) {
      const bypassRole = protection.bypass_role;
      const member = message.member;
      const hasBypass = member && bypassRole && member.roles.cache.has(bypassRole);

      if (!hasBypass && protection.antilink) {
        const linkRegex = /https?:\/\/[^\s]+/i;
        if (linkRegex.test(message.content)) {
          await message.delete().catch(() => null);
          const warnMsg = await message.channel.send({ content: `${message.author}, {emoji:circlex} ممنوع إرسال الروابط هنا` });
          setTimeout(() => warnMsg.delete().catch(() => null), 5000);
          return;
        }
      }

      if (!hasBypass && protection.antispam) {
        const key = `${guildId}_${userId}`;
        const now = Date.now();
        let times = spamTracker.get(key) || [];
        times = times.filter(t => now - t < 5000);
        times.push(now);
        spamTracker.set(key, times);
        if (times.length >= 6) {
          await message.delete().catch(() => null);
          if (member && member.moderatable) {
            await member.timeout(60_000, 'Anti-Spam').catch(() => null);
          }
          const warnMsg = await message.channel.send({ content: `${message.author}, {emoji:alerttriangle} تم رصد سبام` });
          setTimeout(() => warnMsg.delete().catch(() => null), 5000);
          spamTracker.set(key, []);
          return;
        }
      }
    }

    const levelSettings = db.getLevelSettings(guildId);
    if (levelSettings.enabled) {
      const now = Math.floor(Date.now() / 1000);
      const userData = db.getLevel(userId, guildId);
      const cooldown = levelSettings.xp_cooldown !== undefined && levelSettings.xp_cooldown !== null ? levelSettings.xp_cooldown : 60;

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
