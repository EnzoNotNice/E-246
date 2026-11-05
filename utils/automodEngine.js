const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { sendLog } = require('./logger');
const logger = require('./logger');

const spamVelocityTracker = new Map();

function normalizeArabic(text, stripSpaces = false) {
  if (!text) return '';
  const res = text
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '') // Remove zero-width characters and soft hyphens
    .replace(/\u0640/g, '') // Remove tatweel / kashida
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics (tashkeel)
    .replace(/[أإآٱ]/g, 'ا') // Normalize Alif
    .replace(/ة/g, 'ه') // Normalize Ta Marbuta
    .replace(/[يى]/g, 'ي') // Normalize Ya / Alif Maqsura
    .replace(/ؤ/g, 'و') // Normalize Waw
    .replace(/ئ/g, 'ي') // Normalize Hamza on Nabrah
    .toLowerCase();

  if (stripSpaces) {
    return res.replace(/\s+/g, '');
  }
  return res.replace(/\s+/g, ' ').trim();
}

/**
 * Detects if a message violates the blacklisted words list.
 * Resistant to tatweel, zero-width chars, character repeats, and spaced-out letters,
 * while preventing false positives across normal word boundaries (e.g. "أكل بصل" vs "كلب").
 * @param {string} content
 * @param {Array<string>} words
 * @returns {string|null} The matched bad word or null
 */
function detectBadWord(content, words) {
  if (!content || !words || !Array.isArray(words) || words.length === 0) return null;

  const cleaned = normalizeArabic(content, false);
  if (!cleaned) return null;

  // Collapse spaced-out single letters (e.g. "م م ن و ع" or "ك ل ب" -> "ممنوع" or "كلب")
  const seqRegex = /(?:^|[\s\p{P}])(?:[\u0600-\u06FFA-Za-z]\s+){2,}[\u0600-\u06FFA-Za-z](?=[\s\p{P}]|$)/gu;
  const collapsedSpaced = cleaned.replace(seqRegex, (m) => m.replace(/\s+/g, ''));

  // Also build a token set
  const rawTokens = cleaned.split(/[\s\p{P}]+/u).filter(Boolean);
  const collapsedTokens = collapsedSpaced.split(/[\s\p{P}]+/u).filter(Boolean);
  const tokenSet = new Set([...rawTokens, ...collapsedTokens]);

  for (const rawWord of words) {
    const normWord = normalizeArabic(rawWord, false);
    if (!normWord) continue;

    // Multi-word phrase check (e.g. "قليل ادب")
    if (normWord.includes(' ')) {
      if (cleaned.includes(normWord) || collapsedSpaced.includes(normWord)) {
        return rawWord;
      }
      continue;
    }

    // Single word token check
    for (const t of tokenSet) {
      if (t === normWord || t.includes(normWord)) {
        return rawWord;
      }
      // Squash repeats: e.g. "كلللللب" -> "كلب"
      const squashed = t.replace(/(.)\1{2,}/g, '$1');
      if (squashed === normWord || squashed.includes(normWord)) {
        return rawWord;
      }
    }
  }

  return null;
}

/**
 * Checks if a message violates any automod or protection rules,
 * and executes the Smart Escalation Ladder if violated.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} True if message was caught and handled
 */
async function processAutoModAndSecurity(message) {
  try {
    if (!message.guild || !message.member || message.author.bot) return false;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const member = message.member;

    // 1. Bypass Checks
    // Guild Owner is strictly immune
    if (message.guild.ownerId === userId) return false;

    // Administrators are immune
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return false;

    const protection = db.getProtection(guildId) || {};
    const automod = db.getAutomod(guildId) || {};

    // Bypass roles
    if (protection.bypass_role && member.roles.cache.has(protection.bypass_role)) return false;
    if (Array.isArray(automod.bypass_roles) && automod.bypass_roles.some((r) => member.roles.cache.has(r))) {
      return false;
    }

    let violation = null;

    // 2. Anti-Invites Detection (discord.gg, discord.com/invite, with spacing evasion support)
    const inviteRegex =
      /(?:https?:\/\/)?(?:www\.)?(?:discord\s*\.\s*(?:gg|io|me|li|com\/invite)|discordapp\s*\.\s*com\/invite)\s*\/\s*[a-zA-Z0-9-]{2,}/i;
    if (inviteRegex.test(message.content)) {
      if (protection.antilink || protection.enabled || automod.enabled) {
        violation = {
          type: 'anti_invites',
          name: 'نشر روابط دعوة ديسكورد (Anti-Invite)',
          rule: 'Anti-Invites'
        };
      }
    }

    // 3. Anti-Links Detection (external URLs)
    if (!violation && protection.antilink) {
      const linkRegex =
        /(?:https?:\/\/|www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|xyz|info|top|me|ru|gg|co|app|dev|link|site|online)\b[^\s]*/i;
      const antilinkChannels = protection.antilink_channels || [];
      const isChannelMonitored = antilinkChannels.length === 0 || antilinkChannels.includes(message.channel.id);

      if (isChannelMonitored && linkRegex.test(message.content)) {
        violation = {
          type: 'anti_links',
          name: 'نشر روابط خارجية غير مصرح بها (Anti-Link)',
          rule: 'Anti-Links'
        };
      }
    }

    // 4. Anti-Spam Detection (message velocity: >= 5 msgs in 4s)
    if (!violation && (protection.antispam || protection.enabled)) {
      const trackerKey = `${guildId}_${userId}`;
      const now = Date.now();
      let timestamps = spamVelocityTracker.get(trackerKey) || [];
      timestamps = timestamps.filter((t) => now - t < 4000);
      timestamps.push(now);

      if (timestamps.length >= 5) {
        spamVelocityTracker.delete(trackerKey);
        violation = {
          type: 'anti_spam',
          name: 'إرسال رسائل متكررة بسرعة فائقة (Anti-Spam)',
          rule: 'Anti-Spam'
        };
      } else {
        spamVelocityTracker.set(trackerKey, timestamps);
      }

      // Memory leak guard: periodically prune stale entries
      if (spamVelocityTracker.size > 500) {
        for (const [key, tsList] of spamVelocityTracker.entries()) {
          const fresh = tsList.filter((t) => now - t < 4000);
          if (fresh.length === 0) spamVelocityTracker.delete(key);
        }
      }
    }

    // 5. Anti-Mass-Mentions Detection (mentions count > 4)
    if (!violation && (protection.enabled || automod.enabled || protection.antispam)) {
      const userMentions = message.mentions.users.size;
      const roleMentions = message.mentions.roles.size;
      const everyoneMention = message.mentions.everyone ? 1 : 0;
      const totalMentions = userMentions + roleMentions + everyoneMention;

      if (totalMentions > 4) {
        violation = {
          type: 'anti_mass_mentions',
          name: `منشن مكثف لـ (${totalMentions}) أعضاء/رتب (Anti-Mass-Mentions)`,
          rule: 'Anti-Mass-Mentions'
        };
      }
    }

    // 6. Anti-Bad-Words Detection (blacklisted words with smart Arabic normalization)
    if (!violation && automod.enabled && Array.isArray(automod.words) && automod.words.length > 0) {
      const matchedWord = detectBadWord(message.content, automod.words);
      if (matchedWord) {
        violation = {
          type: 'anti_bad_words',
          name: `استخدام كلمات ممنوعة / بذيئة: [${matchedWord}] (Anti-Bad-Words)`,
          rule: 'Anti-Bad-Words'
        };
      }
    }

    if (!violation) return false;

    // ═══════════════════════════════════════════════════════════
    // Smart Escalation Ladder Execution
    // ═══════════════════════════════════════════════════════════
    await message.delete().catch(() => null);

    const previousWarnings = db.getWarnings(userId, guildId) || [];
    const offenseNumber = previousWarnings.length + 1;
    const client = message.client;

    let actionLabel = 'تحذير';
    let chatNotice = '';
    let logChannelType = 'warn';
    let isBan = false;

    if (offenseNumber === 1) {
      // 1st offense: Delete message + Warn in chat & DB
      actionLabel = 'تحذير (Warn)';
      chatNotice = `{emoji:circlex} <@${userId}> **[تحذير - مخالفة 1/4]** ممنوع: ${violation.name}`;
      logChannelType = 'warn';

      db.addWarning(userId, guildId, `[Auto-Mod] ${violation.name}`, client.user.id);
      db.addModAction(guildId, userId, message.author.tag, client.user.id, client.user.tag, 'warn', violation.name);
    } else if (offenseNumber === 2) {
      // 2nd offense: Delete + 10-minute Timeout (Mute)
      actionLabel = 'كتم مؤقت 10 دقائق (10m Timeout)';
      chatNotice = `{emoji:alerttriangle} <@${userId}> **[كتم مؤقت 10 دقائق - مخالفة 2/4]** تم إسكاتك بسبب: ${violation.name}`;
      logChannelType = 'timeout';

      if (member.moderatable) {
        await member.timeout(10 * 60 * 1000, `[Auto-Mod Escalation 2/4] ${violation.name}`).catch(() => null);
      }

      db.addWarning(userId, guildId, `[Auto-Mod كتم 10د] ${violation.name}`, client.user.id);
      db.addModAction(
        guildId,
        userId,
        message.author.tag,
        client.user.id,
        client.user.tag,
        'timeout',
        violation.name,
        '10m'
      );
    } else if (offenseNumber === 3) {
      // 3rd offense: Delete + 24-hour Timeout
      actionLabel = 'كتم لمدة 24 ساعة (24h Timeout)';
      chatNotice = `{emoji:alerttriangle} <@${userId}> **[كتم لمدة 24 ساعة - مخالفة 3/4]** تم إسكاتك ليوم كامل بسبب: ${violation.name}`;
      logChannelType = 'timeout';

      if (member.moderatable) {
        await member.timeout(24 * 60 * 60 * 1000, `[Auto-Mod Escalation 3/4] ${violation.name}`).catch(() => null);
      }

      db.addWarning(userId, guildId, `[Auto-Mod كتم 24س] ${violation.name}`, client.user.id);
      db.addModAction(
        guildId,
        userId,
        message.author.tag,
        client.user.id,
        client.user.tag,
        'timeout',
        violation.name,
        '24h'
      );
    } else {
      // 4th offense+: Delete + Kick or Ban
      const configuredAction = protection.action || 'ban';
      isBan = configuredAction === 'ban';
      actionLabel = isBan ? 'حظر نهائي (Ban)' : 'طرد من السيرفر (Kick)';
      chatNotice = `{emoji:shieldlock} <@${userId}> **[${actionLabel} - مخالفة ${offenseNumber}/4]** لتجاوز الحد الأقصى للمخالفات بسبب: ${violation.name}`;
      logChannelType = isBan ? 'ban' : 'kick';

      if (isBan) {
        if (member.bannable) {
          await member.ban({ reason: `[Auto-Mod Escalation 4/4] ${violation.name}` }).catch(() => null);
        }
      } else {
        if (member.kickable) {
          await member.kick(`[Auto-Mod Escalation 4/4] ${violation.name}`).catch(() => null);
        }
      }

      db.addWarning(userId, guildId, `[Auto-Mod ${isBan ? 'بان' : 'طرد'}] ${violation.name}`, client.user.id);
      db.addModAction(
        guildId,
        userId,
        message.author.tag,
        client.user.id,
        client.user.tag,
        isBan ? 'ban' : 'kick',
        violation.name
      );
    }

    // Send ephemeral-like chat warning (auto-delete after 7 seconds)
    if (chatNotice) {
      const warnMsg = await message.channel.send({ content: chatNotice }).catch(() => null);
      if (warnMsg) {
        setTimeout(() => warnMsg.delete().catch(() => null), 7000);
      }
    }

    // Send rich incident embed to the configured Mod-Log channel (Single dispatch, no duplicate log spam)
    const incidentEmbed = new EmbedBuilder()
      .setColor(offenseNumber >= 4 ? 0xed4245 : offenseNumber >= 2 ? 0xfee75c : 0x5865f2)
      .setTitle(`🛡️ نظام الحماية وسلم العقوبات — مخالفة #${offenseNumber}`)
      .setDescription('تم رصد مخالفة من العضو وتطبيق الإجراء المناسب تلقائياً وفق سلم العقوبات الذكي.')
      .addFields(
        {
          name: '👤 العضو المخالف',
          value: `<@${userId}> (\`${message.author.tag}\` | \`${userId}\`)`,
          inline: true
        },
        {
          name: '⚖️ العقوبة المنفذة',
          value: `**${actionLabel}** (المرحلة ${Math.min(offenseNumber, 4)}/4)`,
          inline: true
        },
        {
          name: '🚨 نوع المخالفة',
          value: `\`${violation.name}\``,
          inline: true
        },
        {
          name: '💬 الروم',
          value: `<#${message.channel.id}>`,
          inline: true
        },
        {
          name: '📝 محتوى الرسالة المحذوفة',
          value: `\`\`\`\n${(message.content || '[رسالة بدون نص / مرفق]').slice(0, 500)}\n\`\`\``,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'E-246 Security Engine | ProBot Parity' });

    // Send once to the appropriate log channel (falls back to mainLogChannel via sendLog)
    await sendLog(client, guildId, incidentEmbed, logChannelType);

    return true;
  } catch (err) {
    logger.error('[AutoMod Engine Error]:', err);
    return false;
  }
}

module.exports = {
  processAutoModAndSecurity,
  normalizeArabic,
  detectBadWord
};
