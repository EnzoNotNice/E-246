const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  name: 'daily',
  aliases: ['راتب', 'يومي', 'يومية', 'salary'],
  async execute(message) {
    try {
      const author = message.author;
      const userId = author.id;
      const guildId = message.guild.id;

      // Check if command is restricted by channel
      const guildSettings = db.getGuildSettings(guildId);
      const bankChannelId = guildSettings ? guildSettings.bank_channel : null;
      if (bankChannelId && message.channel.id !== bankChannelId) {
        return message
          .reply({
            content: `{emoji:circlex} لا يمكنك استخدام أوامر الكريدت والبنك خارج الروم المخصص <#${bankChannelId}>`
          })
          .catch(() => null);
      }

      const now = Date.now();
      const lastDaily = await db.getKV(`daily_last_${userId}`);
      let streak = (await db.getKV(`daily_streak_${userId}`)) || 0;

      const cooldownTime = 24 * 60 * 60 * 1000; // 24 hours

      if (lastDaily && now - lastDaily < cooldownTime) {
        const remaining = cooldownTime - (now - lastDaily);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        return message.reply({
          content: `{emoji:clock} **${author.username}** يرجى الانتظار للحصول على الهدية اليومية مرة أخرى\nالوقت المتبقي **${hours} ساعة و ${minutes} دقيقة و ${seconds} ثانية**`
        });
      }

      // Check streak: if claimed within 48 hours, increment; otherwise reset to 1
      if (lastDaily && now - lastDaily <= 48 * 60 * 60 * 1000) {
        streak += 1;
      } else {
        streak = 1;
      }

      const baseReward = Math.floor(Math.random() * 1000) + 1200; // 1200 - 2200
      const streakBonus = Math.min(streak * 200, 5000);
      const totalReward = baseReward + streakBonus;

      let currentBalance = (await db.getKV(`balance_${userId}`)) || 0;
      currentBalance += totalReward;

      await db.setKV(`balance_${userId}`, currentBalance);
      await db.setKV(`daily_last_${userId}`, now);
      await db.setKV(`daily_streak_${userId}`, streak);
      db.incrementQuestProgress(userId, 'daily', 1);

      if (message.guild) {
        const { recordUserStreakActivity } = require('../../utils/streakManager');
        await recordUserStreakActivity(message.guild, author, 'daily').catch(() => null);
      }

      return message.reply({
        content: `{emoji:icon_earned} **${author.username}** لقد حصلت على **$${totalReward.toLocaleString()}** رصيد يومي\n- المكافأة الأساسية \`$${baseReward.toLocaleString()}\`\n- بونص الستريك \`$${streakBonus.toLocaleString()}\`\n{emoji:flame} **الستريك الحالي** \`${streak} ${streak === 1 ? 'يوم' : 'أيام'}\` متتالية`
      });
    } catch (err) {
      logger.error('[Command Error - daily.js]:', err);
      message.reply({ content: '{emoji:circlex} حدث خطأ أثناء استلام المكافأة اليومية' }).catch(() => null);
    }
  }
};
