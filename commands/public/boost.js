const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { getUserBoostInfo } = require('../../utils/selfbotHelper');
const { formatExactTime, getMsSince } = require('../../utils/timeFormatters');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boost')
    .setDescription('معلومات البوست لعضو')
    .addUserOption((option) => option.setName('target').setDescription('العضو لمعلومات البوست')),
  async getBoostPayload(target, userToken) {
    try {
      const boostRes = await getUserBoostInfo(userToken, target.id);

      if (!boostRes.success) {
        return {
          content: `❌ فشل في جلب بيانات البوست للعضو. السبب: ${boostRes.error}`,
          components: [],
          files: []
        };
      }

      const boostData = boostRes.data;

      if (!boostData.hasBoost && boostData.boostMonths === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setDescription(`**${target.username}** ليس لديه أي بوستات نشطة في هذا السيرفر`)
          ]
        };
      }

      const nextTierNum = boostData.badgeTier > 0 && boostData.badgeTier < 9 ? boostData.badgeTier + 1 : null;
      const msSince = getMsSince(boostData.oldestBoostDate);
      const emojis = require('../../utils/emojis.json');
      const profileTimestamp = Math.floor(new Date(boostData.oldestBoostDate).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`${emojis.boost_progression || '💖'} ${target.displayName} Boost Progression`)
        .setColor(0xff73fa)
        .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 512 }))
        .setDescription(
          `<@${target.id}> \`(${target.username})\`\n\n` +
            `**Boost Type:** Server Boost\n` +
            `${emojis.icon_time || '📅'} **Boosting Since:** <t:${profileTimestamp}:R> - ${formatExactTime(msSince)}`
        );

      const currentEmojiStr = emojis[`boost_${boostData.badgeTier}`] || '';
      const earnedMsSince = getMsSince(boostData.currentBadgeEarnedDate);
      const currentEarnedTimestamp = Math.floor(new Date(boostData.currentBadgeEarnedDate).getTime() / 1000);

      embed.addFields({
        name: 'Current Level',
        value:
          `${currentEmojiStr} **Level ${boostData.badgeTier}** ${currentEmojiStr} (${boostData.boostMonths} Month${boostData.boostMonths !== 1 ? 's' : ''})\n` +
          `${emojis.icon_earned || '⭐'} Earned: <t:${currentEarnedTimestamp}:R> - ${formatExactTime(earnedMsSince)} ago`
      });

      if (nextTierNum) {
        const nextEmojiStr = emojis[`boost_${nextTierNum}`] || '';
        const nextMonths = [0, 1, 2, 3, 6, 9, 12, 15, 18, 24][nextTierNum] || 24;

        let timeRemContent = 'Soon';
        if (boostData.timeRemainingMs !== null) {
          const nextEarnedTimestamp = Math.floor((Date.now() + boostData.timeRemainingMs) / 1000);
          timeRemContent = `<t:${nextEarnedTimestamp}:R> - In ${formatExactTime(boostData.timeRemainingMs)}`;
        }

        embed.addFields({
          name: 'Next Level',
          value:
            `${nextEmojiStr} **Level ${nextTierNum}** ${nextEmojiStr} (${nextMonths} Month${nextMonths !== 1 ? 's' : ''})\n` +
            `${emojis.icon_time || '📅'} Time Remaining: ${timeRemContent}`
        });
      }

      const { generateBoostCard } = require('../../utils/canvasHelper');
      const buffer = await generateBoostCard(boostData, target.displayAvatarURL({ extension: 'png', size: 512 }));

      const files = [new AttachmentBuilder(buffer, { name: 'boost_canvas.png' })];
      embed.setImage('attachment://boost_canvas.png');

      return {
        embeds: [embed],
        files: files
      };
    } catch (e) {
      logger.error('Failed to fetch selfbot boost stats or generate components', e);
      throw e;
    }
  },
  async getNativeBoostPayload(target, member, guild) {
    const emojis = require('../../utils/emojis.json');
    const guildBoosts = guild?.premiumSubscriptionCount || 0;
    const guildTier = guild?.premiumTier || 0;

    if (!member || !member.premiumSince) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`💖 ${target.displayName || target.username} - Boost Info`)
        .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 512 }))
        .setDescription(
          `**${target.username}** ليس لديه أي بوستات نشطة في هذا السيرفر حالياً.\n\n` +
            `**إحصائيات بوست السيرفر:**\n` +
            `• إجمالي البوستات: \`${guildBoosts}\` بوست\n` +
            `• مستوى السيرفر: \`Level ${guildTier}\``
        );
      return { embeds: [embed] };
    }

    const premiumDate = new Date(member.premiumSince);
    const msSince = Math.max(0, Date.now() - premiumDate.getTime());
    const boostMonths = Math.max(1, Math.floor(msSince / (1000 * 60 * 60 * 24 * 30.4375)));

    // Badge tier milestones: [0, 1, 2, 3, 6, 9, 12, 15, 18, 24]
    const milestones = [0, 1, 2, 3, 6, 9, 12, 15, 18, 24];
    let badgeTier = 1;
    for (let i = 1; i < milestones.length; i++) {
      if (boostMonths >= milestones[i]) {
        badgeTier = i;
      }
    }

    const nextTierNum = badgeTier < 9 ? badgeTier + 1 : null;
    let timeRemainingMs = null;
    if (nextTierNum) {
      const nextMonths = milestones[nextTierNum];
      const targetMs = nextMonths * 30.4375 * 24 * 3600 * 1000;
      timeRemainingMs = Math.max(0, targetMs - msSince);
    }

    const boostData = {
      hasBoost: true,
      badgeTier,
      boostMonths,
      oldestBoostDate: premiumDate.toISOString(),
      currentBadgeEarnedDate: new Date(Date.now() - (msSince % (30 * 24 * 3600 * 1000))).toISOString(),
      timeRemainingMs,
      daysRemaining: timeRemainingMs !== null ? Math.ceil(timeRemainingMs / (24 * 3600 * 1000)) : null
    };

    const profileTimestamp = Math.floor(premiumDate.getTime() / 1000);
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.boost_progression || '💖'} ${target.displayName || target.username} Boost Progression`)
      .setColor(0xff73fa)
      .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 512 }))
      .setDescription(
        `<@${target.id}> \`(${target.username})\`\n\n` +
          `**Boost Type:** Server Boost (Native Discord API)\n` +
          `${emojis.icon_time || '📅'} **Boosting Since:** <t:${profileTimestamp}:R> - ${formatExactTime(msSince)}\n` +
          `**السيرفر:** ${guildBoosts} بوست (المستوى ${guildTier})`
      );

    const currentEmojiStr = emojis[`boost_${badgeTier}`] || '💖';
    embed.addFields({
      name: 'Current Level',
      value: `${currentEmojiStr} **Level ${badgeTier}** (${boostMonths} Month${boostMonths !== 1 ? 's' : ''})`
    });

    if (nextTierNum) {
      const nextEmojiStr = emojis[`boost_${nextTierNum}`] || '⭐';
      const nextMonths = milestones[nextTierNum];
      let timeRemContent = 'Soon';
      if (timeRemainingMs !== null) {
        const nextEarnedTimestamp = Math.floor((Date.now() + timeRemainingMs) / 1000);
        timeRemContent = `<t:${nextEarnedTimestamp}:R> - In ${formatExactTime(timeRemainingMs)}`;
      }
      embed.addFields({
        name: 'Next Level',
        value: `${nextEmojiStr} **Level ${nextTierNum}** (${nextMonths} Months)\n${emojis.icon_time || '📅'} Time Remaining: ${timeRemContent}`
      });
    }

    try {
      const { generateBoostCard } = require('../../utils/canvasHelper');
      const buffer = await generateBoostCard(boostData, target.displayAvatarURL({ extension: 'png', size: 512 }));
      const files = [new AttachmentBuilder(buffer, { name: 'boost_canvas.png' })];
      embed.setImage('attachment://boost_canvas.png');
      return { embeds: [embed], files };
    } catch (err) {
      logger.warn('[Boost Canvas] Could not generate boost card buffer, returning rich embed:', err.message);
      return { embeds: [embed] };
    }
  },
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('target') || interaction.user;
    await target.fetch().catch(() => null);

    const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
    const userToken = process.env.USER_TOKEN;

    if (userToken) {
      try {
        const payload = await module.exports.getBoostPayload(target, userToken);
        if (payload && !payload.content?.startsWith('❌')) {
          return interaction.editReply(payload);
        }
      } catch (e) {
        logger.warn('[Boost] Selfbot fetch failed, falling back to native Discord API:', e.message);
      }
    }

    // Native Discord API fallback
    try {
      const nativePayload = await module.exports.getNativeBoostPayload(target, member, interaction.guild);
      return interaction.editReply(nativePayload);
    } catch (err) {
      logger.error('[Boost] Error executing native boost payload:', err);
      return interaction.editReply({ content: '❌ حدث خطأ أثناء جلب بيانات البوست.' });
    }
  }
};
