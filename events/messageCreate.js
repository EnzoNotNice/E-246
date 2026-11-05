const { PermissionsBitField } = require('discord.js');
const db = require('../database/db');
const logger = require('../utils/logger');
const { processAutoModAndSecurity } = require('../utils/automodEngine');

const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/i;

const BILINGUAL_ALIASES = {
  // Credits & Economy
  credits: 'credits',
  credit: 'credits',
  كريدت: 'credits',
  رصيد: 'credits',
  فلوس: 'credits',
  c: 'credits',

  daily: 'daily',
  راتب: 'daily',
  يومي: 'daily',
  يومية: 'daily',
  salary: 'daily',

  rep: 'rep',
  سمعة: 'rep',
  سمعه: 'rep',
  point: 'rep',

  title: 'title',
  لقب: 'title',
  بايو: 'title',
  bio: 'title',

  streak: 'streak',
  ستريك: 'streak',

  // Profile & Levels
  profile: 'profile',
  بروفايل: 'profile',
  بروفايلي: 'profile',
  حسابي: 'profile',
  id: 'profile',

  rank: 'rank',
  رتبتي: 'rank',
  رتبة: 'rank',
  رتبه: 'rank',
  level: 'rank',
  مستواي: 'rank',

  top: 'top',
  توب: 'top',
  متصدرين: 'top',
  اوائل: 'top',
  أوائل: 'top',
  leaderboard: 'top',

  // Moderation
  clear: 'clear',
  مسح: 'clear',
  نظف: 'clear',
  تنظيف: 'clear',
  purge: 'clear',

  mute: 'timeout',
  timeout: 'timeout',
  كتم: 'timeout',
  اسكات: 'timeout',
  إسكات: 'timeout',

  unmute: 'untimeout',
  untimeout: 'untimeout',
  'فك-كتم': 'untimeout',
  فك_كتم: 'untimeout',
  تكلم: 'untimeout',

  ban: 'ban',
  باند: 'ban',
  حظر: 'ban',

  unban: 'unban',
  'فك-باند': 'unban',
  فك_باند: 'unban',
  'فك-حظر': 'unban',
  فك_حظر: 'unban',

  kick: 'kick',
  طرد: 'kick',

  warn: 'warn',
  تحذير: 'warn',
  انذار: 'warn',
  إنذار: 'warn',

  warnings: 'warnings',
  تحذيرات: 'warnings',
  سجل: 'warnings',

  unwarn: 'unwarn',
  'فك-تحذير': 'unwarn',
  'مسح-تحذير': 'unwarn',

  lock: 'lock',
  قفل: 'lock',

  unlock: 'unlock',
  فتح: 'unlock',

  user: 'user',
  معلومات: 'user',
  يوزر: 'user',

  server: 'server',
  سيرفر: 'server',

  avatar: 'avatar',
  افتار: 'avatar',
  أفتار: 'avatar',
  صورة: 'avatar',

  ping: 'ping',
  بنق: 'ping',
  بينج: 'ping',

  help: 'help',
  مساعدة: 'help',
  اوامر: 'help',
  أوامر: 'help'
};

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild) return;

    const channelId = message.channel.id;
    const client = message.client;

    // ═══════════════════════════════════════════
    // Sticky Message debounced handler (runs for everyone except our own bot)
    // ═══════════════════════════════════════════
    if (message.author.id !== client.user.id) {
      const sticky = db.getStickyMessage(channelId);
      if (sticky && sticky.enabled) {
        const stickyTimeouts = client.stickyTimeouts || new Map();
        if (stickyTimeouts.has(channelId)) {
          clearTimeout(stickyTimeouts.get(channelId));
        }

        const timeoutId = setTimeout(async () => {
          stickyTimeouts.delete(channelId);
          const currentSticky = db.getStickyMessage(channelId);
          if (!currentSticky || !currentSticky.enabled) return;

          if (currentSticky.lastMessageId) {
            const oldMsg = await message.channel.messages.fetch(currentSticky.lastMessageId).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => null);
          }

          const newMsg = await message.channel
            .send({
              content: `__**رسالة مثبتة**__\n\n${currentSticky.content}`
            })
            .catch(() => null);
          if (newMsg) {
            db.updateStickyMessageId(channelId, newMsg.id);
          }
        }, 3000);

        stickyTimeouts.set(channelId, timeoutId);
        client.stickyTimeouts = stickyTimeouts;
      }
    }

    if (message.author.bot) return;

    db.saveMessage(
      message.id,
      message.channel.id,
      message.guild.id,
      message.author.id,
      message.author.tag,
      message.author.displayAvatarURL(),
      message.content,
      message.attachments.map((att) => att.url)
    );

    const guildId = message.guild.id;
    const userId = message.author.id;

    // ── Ticket Activity & Metrics Tracking ──
    const ticketDoc = db.getTicketByChannel(channelId);
    if (ticketDoc && ticketDoc.status === 'open') {
      const isStaff =
        message.member?.permissions?.has(PermissionsBitField.Flags.ManageChannels) ||
        message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild) ||
        (ticketDoc.departmentRole && message.member?.roles?.cache?.has(ticketDoc.departmentRole));
      db.updateTicketActivity(channelId, message.author.id, Boolean(isStaff));
    }

    // ═══════════════════════════════════════════
    // AFK Check: Author is AFK
    // ═══════════════════════════════════════════
    const authorAfk = db.getAFK(guildId, userId);
    if (authorAfk) {
      db.removeAFK(guildId, userId);
      const oldName = message.member?.displayName;
      if (oldName && oldName.startsWith('[AFK] ')) {
        await message.member.setNickname(oldName.replace('[AFK] ', '')).catch(() => null);
      }
      await message
        .reply({
          content: `{emoji:circlecheck} مرحباً بعودتك <@${userId}>، تم إيقاف وضع الـ **AFK** تلقائياً`
        })
        .then((msg) => {
          setTimeout(() => msg.delete().catch(() => null), 5000);
        })
        .catch(() => null);
    }

    // AFK Check: Mentioned Users are AFK
    if (message.mentions.members && message.mentions.members.size > 0) {
      for (const [mentionedId, member] of message.mentions.members) {
        if (mentionedId === userId) continue;
        const targetAfk = db.getAFK(guildId, mentionedId);
        if (targetAfk) {
          const timeAgo = `<t:${Math.floor(targetAfk.timestamp / 1000)}:R>`;
          await message
            .reply({
              content: `{emoji:clock} **${member.displayName}** في وضع الخمول حالياً\n- **السبب:** '${targetAfk.reason}'\n- **منذ:** ${timeAgo}`
            })
            .catch(() => null);
        }
      }
    }

    // ═══════════════════════════════════════════
    // Real-Time AutoMod & Security Engine with Smart Escalation Ladder
    // ═══════════════════════════════════════════
    const caughtByAutoMod = await processAutoModAndSecurity(message);
    if (caughtByAutoMod) return;

    const prefix = db.getGuildSettings(guildId)?.prefix || '#';

    let isCommand = false;

    const customCommands = db.getCustomCommands(guildId);
    const contentTrimmed = message.content.trim().toLowerCase();
    const matchedCustomCmd = customCommands.find((c) => c.trigger === contentTrimmed);
    if (matchedCustomCmd) {
      for (const action of matchedCustomCmd.actions) {
        const val = String(action.value || '')
          .replace(/{user}/g, `<@${message.author.id}>`)
          .replace(/{server}/g, message.guild.name);

        try {
          if (action.type === 'reply_text') {
            await message.channel.send(val);
          } else if (action.type === 'reply_embed') {
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder().setDescription(val).setColor('#5865F2');
            await message.channel.send({ embeds: [embed] });
          } else if (action.type === 'add_role') {
            const role = message.guild.roles.cache.get(action.value);
            if (role && message.member) await message.member.roles.add(role).catch(() => null);
          } else if (action.type === 'remove_role') {
            const role = message.guild.roles.cache.get(action.value);
            if (role && message.member) await message.member.roles.remove(role).catch(() => null);
          } else if (action.type === 'delete_message') {
            if (message.deletable) await message.delete().catch(() => null);
          }
        } catch (e) {
          logger.error('Custom Command Execution Error:', e);
        }
      }
      return; // Stop processing further commands or replies
    }
    // -----------------------------
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

      const runSlash = async (slashCmd, runArgs) => {
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
          logger.error(e);
          if (!fakeInteraction.replied && !fakeInteraction.deferred) {
            await message.reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ الأمر.' }).catch(() => null);
          } else {
            await fakeInteraction
              .editReply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ الأمر.' })
              .catch(() => null);
          }
        }
      };

      const mappedName = BILINGUAL_ALIASES[commandName] || commandName;

      const cmd =
        client.prefixCommands.get(commandName) ||
        client.prefixCommands.get(mappedName) ||
        client.prefixCommands.find(
          (c) => c.aliases && (c.aliases.includes(commandName) || c.aliases.includes(mappedName))
        );
      if (cmd) {
        // Check command restrictions
        const restrictions =
          db.getCommandRestrictions(guildId, commandName) || db.getCommandRestrictions(guildId, mappedName);
        if (restrictions) {
          // Check role restrictions
          if (
            restrictions.allowedRoles &&
            Array.isArray(restrictions.allowedRoles) &&
            restrictions.allowedRoles.length > 0
          ) {
            const hasRole = message.member.roles.cache.some((role) => restrictions.allowedRoles.includes(role.id));
            if (!hasRole) {
              return message
                .reply({ content: '{emoji:circlex} ليس لديك الرتبة المطلوبة لاستخدام هذا الأمر.' })
                .catch(() => null);
            }
          }
          // Check channel restrictions
          if (
            restrictions.allowedChannels &&
            Array.isArray(restrictions.allowedChannels) &&
            restrictions.allowedChannels.length > 0
          ) {
            if (!restrictions.allowedChannels.includes(channelId)) {
              return message.reply({ content: '{emoji:circlex} هذا الأمر غير متاح في هذا الروم.' }).catch(() => null);
            }
          }
        }

        try {
          await cmd.execute(message, args);
        } catch (e) {
          logger.error(e);
        }
        return;
      }

      let slashCmd = client.commands.get(commandName) || client.commands.get(mappedName);
      let runArgs = args;

      if (!slashCmd) {
        const alias =
          resolvedAlias ||
          customAliases.find(
            (a) => normalizeShort(a.shortcut) === commandName || normalizeShort(a.shortcut) === mappedName
          );
        if (alias) {
          const aliasParts = String(alias.command || '')
            .replace(/^\//, '')
            .trim()
            .split(/ +/)
            .filter(Boolean);
          const mappedName2 = (aliasParts.shift() || '').toLowerCase();
          slashCmd = client.commands.get(mappedName2) || client.commands.get(BILINGUAL_ALIASES[mappedName2]);
          runArgs = [...aliasParts, ...args];
        }
      }

      if (slashCmd) {
        const requiredPerms = slashCmd.data?.defaultMemberPermissions;
        if (requiredPerms && message.member && !message.member.permissions.has(requiredPerms)) {
          return message.reply({ content: '{emoji:circlex} ليس لديك صلاحية استخدام هذا الأمر.' }).catch(() => null);
        }

        const cmdRestrictions = db.getCommandRestrictions(guildId, slashCmd.data?.name || commandName);
        const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        if (cmdRestrictions && !isAdmin) {
          if (
            cmdRestrictions.allowedRoles &&
            Array.isArray(cmdRestrictions.allowedRoles) &&
            cmdRestrictions.allowedRoles.length > 0
          ) {
            const hasRole = message.member.roles.cache.some((r) => cmdRestrictions.allowedRoles.includes(r.id));
            if (!hasRole) {
              return message
                .reply({ content: '{emoji:circlex} ليس لديك الرتبة المطلوبة لاستخدام هذا الأمر.' })
                .catch(() => null);
            }
          }
          if (
            cmdRestrictions.allowedChannels &&
            Array.isArray(cmdRestrictions.allowedChannels) &&
            cmdRestrictions.allowedChannels.length > 0
          ) {
            if (!cmdRestrictions.allowedChannels.includes(channelId)) {
              return message.reply({ content: '{emoji:circlex} هذا الأمر غير متاح في هذا الروم.' }).catch(() => null);
            }
          }
        }

        await runSlash(slashCmd, runArgs);
        return;
      }
    }

    if ([8, 9, 10, 11].includes(message.type)) {
      const boostSettings = db.getBoostSettings(guildId);
      if (boostSettings.channelId && boostSettings.message) {
        const boostChannel = message.guild.channels.cache.get(boostSettings.channelId);
        if (boostChannel) {
          const msg = boostSettings.message.replace(/{user}/g, `<@${message.author.id}>`);
          if (boostSettings.useEmbed) {
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder().setColor(0xff73e1).setDescription(msg).setTimestamp();
            boostChannel.send({ embeds: [embed] }).catch(() => null);
          } else {
            boostChannel.send(msg).catch(() => null);
          }
        }
      }
    }

    db.incrementHourlyMessages(guildId);
    db.incrementQuestProgress(userId, 'chat', 1);

    const replies = db.getAutoReplies(guildId);
    for (const r of replies) {
      const trigger = String(r.trigger || '')
        .trim()
        .toLowerCase();
      if (!trigger) continue;

      const isExactMatch = contentTrimmed === trigger;
      const isContainsMatch = r.matchType === 'contains' && contentTrimmed.includes(trigger);

      if (isExactMatch || isContainsMatch) {
        if (r.mode === 'message') {
          message.channel.send({ content: r.response }).catch(() => null);
        } else {
          message.reply({ content: r.response }).catch(() => null);
        }
        if (r.deleteTrigger) {
          setTimeout(() => {
            message.delete().catch(() => null);
          }, 1000);
        }
        break;
      }
    }

    // Feelings room logic
    const feelingsSettings = db.getFeelingsSettings(guildId);
    if (feelingsSettings.channelId === channelId) {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder().setColor(0x5865f2).setDescription(message.content).setTimestamp();

      if (!feelingsSettings.anonymous) {
        embed.setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL()
        });
      }

      await message.delete().catch(() => null);
      await message.channel.send({ embeds: [embed] }).catch(() => null);
      return;
    }

    const automations = db.getAutomation(guildId, channelId);
    for (const a of automations) {
      if (a.type === 'images') {
        const hasImage = message.attachments.some((att) => att.contentType?.startsWith('image/'));
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
        // Prevent autotax if the author is currently answering a transfer captcha
        const creditsCmd = client.prefixCommands?.get('credits');
        if (creditsCmd?.isUserTransferring && creditsCmd.isUserTransferring(userId)) {
          continue;
        }

        const amountStr = message.content.toLowerCase().trim();
        // Autotax in ProBot must ONLY match pure numeric inputs (e.g. "5000", "50k", "1.5m")
        if (/^\d+(\.\d+)?[kmb]?$/i.test(amountStr)) {
          let multiplier = 1;
          let numStr = amountStr;
          if (numStr.endsWith('k')) {
            multiplier = 1000;
            numStr = numStr.slice(0, -1);
          } else if (numStr.endsWith('m')) {
            multiplier = 1000000;
            numStr = numStr.slice(0, -1);
          } else if (numStr.endsWith('b')) {
            multiplier = 1000000000;
            numStr = numStr.slice(0, -1);
          }

          const amount = parseFloat(numStr) * multiplier;
          if (!isNaN(amount) && amount > 0) {
            const tax = Math.floor(amount * (20 / 19) + 1);
            message.reply({ content: `{emoji:ProBot} **${tax}**` }).catch(() => null);

            // Send line separator after tax if configured
            const settings = db.getGuildSettings(guildId);
            if (settings.tax_line_image) {
              setTimeout(() => {
                message.channel.send({ content: settings.tax_line_image }).catch(() => null);
              }, 500);
            }
          }
        }
      }
      if (a.type === 'react' && a.value) {
        message.react(a.value).catch(() => null);
      }
    }

    const levelSettings = db.getLevelSettings(guildId);
    if (levelSettings.enabled) {
      const now = Math.floor(Date.now() / 1000);
      const userData = db.getLevel(userId, guildId);
      const cooldown =
        levelSettings.xp_cooldown !== undefined && levelSettings.xp_cooldown !== null ? levelSettings.xp_cooldown : 60;

      if (!userData || now - (userData.last_message || 0) >= cooldown) {
        let xpGain = Math.floor(
          Math.random() * (levelSettings.xp_max - levelSettings.xp_min + 1) + levelSettings.xp_min
        );

        // 1.5x XP multiplier perk for server boosters
        if (message.member?.premiumSince) {
          xpGain = Math.floor(xpGain * 1.5);
        }

        db.addXP(userId, guildId, xpGain);
        const { checkLevelUp } = require('../utils/levels');
        await checkLevelUp(client, userId, guildId, channelId);
      }
    }

    // Record Streak Activity
    const { recordUserStreakActivity } = require('../utils/streakManager');
    recordUserStreakActivity(message.guild, message.author, 'chat').catch(() => null);
  }
};
