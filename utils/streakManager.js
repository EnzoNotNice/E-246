const db = require('../database/db');
const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');

/**
 * Record user activity for streak tracking across messages or daily claims
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} user
 * @param {'chat' | 'daily'} activityType
 */
async function recordUserStreakActivity(guild, user, activityType = 'chat') {
  if (!guild || !user || user.bot) return null;

  try {
    const settings = db.getStreakSettings(guild.id);
    if (!settings || !settings.enabled) return null;

    if (settings.streak_type !== 'all' && settings.streak_type !== activityType) {
      return null;
    }

    const userStreak = db.getUserStreak(guild.id, user.id);
    const now = Date.now();
    const lastActive = userStreak.last_active || 0;
    const elapsed = now - lastActive;

    const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
    const MIN_CLAIM_INTERVAL = 20 * 60 * 60 * 1000; // 20 hours minimum to count as a new day

    // If user was active recently within current 20-hour window, don't double count
    if (lastActive > 0 && elapsed < MIN_CLAIM_INTERVAL) {
      return {
        status: 'already_active',
        current_streak: userStreak.current_streak,
        highest_streak: userStreak.highest_streak
      };
    }

    let newStreak = userStreak.current_streak || 0;
    let status = 'active';

    if (lastActive === 0) {
      newStreak = 1;
    } else if (elapsed <= GRACE_PERIOD_MS) {
      newStreak += 1;
    } else {
      // Over 48 hours: Check if user has streak freeze
      if (settings.freeze_enabled && (userStreak.freezes || 0) > 0 && newStreak > 1) {
        userStreak.freezes -= 1;
        status = 'frozen';
      } else {
        newStreak = 1;
        status = 'reset';
      }
    }

    const highestStreak = Math.max(userStreak.highest_streak || 0, newStreak);

    await db.updateUserStreak(guild.id, user.id, {
      current_streak: newStreak,
      highest_streak: highestStreak,
      last_active: now,
      freezes: userStreak.freezes !== undefined ? userStreak.freezes : 1
    });

    // Synchronize global daily streak KV for profile canvas
    await db.setKV(`daily_streak_${user.id}`, newStreak);

    // Milestone Role Rewards Check
    let roleRewards = settings.role_rewards;
    if (typeof roleRewards === 'string') {
      roleRewards = db.safeJsonParse ? db.safeJsonParse(roleRewards, []) : JSON.parse(roleRewards);
    }

    if (Array.isArray(roleRewards) && roleRewards.length > 0) {
      const matchingReward = roleRewards.find((r) => parseInt(r.days, 10) === newStreak);
      if (matchingReward && matchingReward.role_id) {
        try {
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (member && !member.roles.cache.has(matchingReward.role_id)) {
            await member.roles.add(matchingReward.role_id).catch(() => null);

            // Announce milestone in streak channel or active channel
            const notifyChannelId = settings.channel_id;
            const notifyChannel = notifyChannelId ? guild.channels.cache.get(notifyChannelId) : null;
            if (notifyChannel && notifyChannel.isTextBased()) {
              const embed = new EmbedBuilder()
                .setColor('#f59e0b')
                .setTitle('{emoji:flame} إنجاز جديد في الستريك')
                .setDescription(
                  `تهانينا <@${user.id}> حافظت على نشاط متواصل لمدة **${newStreak}** ${newStreak === 1 ? 'يوم' : 'أيام'} متتالية\n\n{emoji:crown} تم منحك رتبة <@&${matchingReward.role_id}> كمكافأة لنشاطك الدائم {emoji:bolt}`
                )
                .setFooter({ text: guild.name, iconURL: guild.iconURL?.() || undefined })
                .setTimestamp();

              await notifyChannel.send({ embeds: [embed] }).catch(() => null);
            }
          }
        } catch (err) {
          logger.error('[Streak Role Reward Error]:', err.message);
        }
      }
    }

    return {
      status,
      current_streak: newStreak,
      highest_streak: highestStreak
    };
  } catch (err) {
    logger.error('[Streak Manager Error]:', err.message);
    return null;
  }
}

module.exports = {
  recordUserStreakActivity
};
