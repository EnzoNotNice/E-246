const { AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { generateProfileCard } = require('../../utils/profileCanvas');
const { getTextNextLvlXp } = require('../../utils/levels');
const logger = require('../../utils/logger');

module.exports = {
  name: 'profile',
  aliases: ['بروفايل', 'بروفايلي', 'حسابي', 'id'],
  async execute(message, args) {
    try {
      const client = message.client;
      let targetUser = message.author;

      if (args && args.length > 0) {
        const match = args[0].match(/^<@!?(\d+)>$/) || [null, args[0]];
        const targetId = match[1];
        if (targetId && /^\d{17,20}$/.test(targetId)) {
          const fetched = await client.users.fetch(targetId).catch(() => null);
          if (fetched) targetUser = fetched;
        }
      }

      const guildId = message.guild.id;
      const member = await message.guild.members.fetch(targetUser.id).catch(() => null);

      const levelData = db.getLevel(targetUser.id, guildId) || { xp: 0, level: 0 };
      const currentLevel = levelData.level || 0;
      const currentXp = levelData.xp || 0;
      const neededXp = getTextNextLvlXp(currentLevel);

      const userRank = db.getUserRank ? db.getUserRank(targetUser.id, guildId) || 1 : 1;
      const userBalance = (await db.getKV(`balance_${targetUser.id}`)) || 0;
      const userRep = (await db.getKV(`rep_${targetUser.id}`)) || 0;
      const userBio = (await db.getKV(`bio_${targetUser.id}`)) || 'عضو مميز في السيرفر';
      const userStreak = (await db.getKV(`daily_streak_${targetUser.id}`)) || 0;

      const buffer = await generateProfileCard(member || targetUser, {
        credits: userBalance,
        rank: userRank,
        level: currentLevel,
        xp: currentXp,
        neededXp,
        rep: userRep,
        bio: userBio,
        streak: userStreak,
        status: member?.presence?.status || 'offline'
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });
      return message.reply({ files: [attachment] });
    } catch (err) {
      logger.error('[Command Error - profile.js]:', err);
      message.reply({ content: '❌ حدث خطأ أثناء إنشاء بطاقة البروفايل.' }).catch(() => null);
    }
  }
};
