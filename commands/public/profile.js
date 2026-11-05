const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { generateProfileCard } = require('../../utils/profileCanvas');
const { getTextNextLvlXp } = require('../../utils/levels');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('عرض بطاقة الملف الشخصي (البروفايل)')
    .addUserOption((o) => o.setName('user').setDescription('العضو المراد عرض بروفايله')),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guildId;
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

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
      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      logger.error('[Slash Command Error - profile.js]:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء بطاقة البروفايل.' }).catch(() => null);
      } else {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء إنشاء بطاقة البروفايل.', ephemeral: true })
          .catch(() => null);
      }
    }
  }
};
