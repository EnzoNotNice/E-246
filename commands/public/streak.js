const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('عرض إحصائيات ونشاط سلسلة الستريك اليومي')
    .addSubcommand((sub) =>
      sub
        .setName('me')
        .setDescription('عرض تفاصيل الستريك الخاص بك في السيرفر')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('العضو المراد عرض الستريك الخاص به').setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName('top').setDescription('عرض قائمة المتصدرين بأطول ستريك في السيرفر')),

  async execute(interaction) {
    try {
      const { guild } = interaction;
      if (!guild) {
        return await interaction.reply({
          content: '{emoji:circlex} هذا الأمر متاح داخل السيرفرات فقط',
          ephemeral: true
        });
      }

      const subcommand = interaction.options.getSubcommand() || 'me';

      if (subcommand === 'top') {
        const topStreaks = db.getTopStreaks(guild.id, 10);
        if (!topStreaks || topStreaks.length === 0) {
          return await interaction.reply({
            content:
              '{emoji:flame} لا توجد سلاسل ستريك مسجلة في هذا السيرفر حتى الآن ابدأ بالحديث أو طلب المكافأة اليومية لتسجيل أول ستريك'
          });
        }

        const medals = [
          '{emoji:trophy}',
          '{emoji:num_2}',
          '{emoji:num_3}',
          '{emoji:num_4}',
          '{emoji:num_5}',
          '{emoji:num_6}',
          '{emoji:num_7}',
          '{emoji:num_8}',
          '{emoji:num_9}',
          '{emoji:num_10}'
        ];
        const descriptionList = [];

        for (let i = 0; i < topStreaks.length; i++) {
          const row = topStreaks[i];
          const medal = medals[i] || '▫️';
          descriptionList.push(
            `${medal} <@${row.userId}> **${row.current_streak}** يوم متواصل {emoji:flame} *(أعلى رقم ${row.highest_streak || row.current_streak})*`
          );
        }

        const embed = new EmbedBuilder()
          .setColor('#f59e0b')
          .setTitle(`{emoji:trophy} متصدرو الستريك في ${guild.name}`)
          .setDescription(descriptionList.join('\n\n'))
          .setFooter({ text: 'حافظ على نشاطك اليومي لتبقى في الصدارة', iconURL: guild.iconURL?.() || undefined })
          .setTimestamp();

        return await interaction.reply({ embeds: [embed] });
      }

      // Subcommand 'me'
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const streakData = db.getUserStreak(guild.id, targetUser.id);
      const settings = db.getStreakSettings(guild.id);

      const currentStreak = streakData.current_streak || 0;
      const highestStreak = streakData.highest_streak || currentStreak;
      const freezes = streakData.freezes !== undefined ? streakData.freezes : 1;
      const lastActiveTime = streakData.last_active
        ? `<t:${Math.floor(streakData.last_active / 1000)}:R>`
        : 'لم يسجل نشاط بعد';

      // Find next role reward milestone
      let nextMilestoneText = 'لا توجد مكافآت رتب قادمة';
      let roleRewards = settings.role_rewards;
      if (typeof roleRewards === 'string') {
        roleRewards = db.safeJsonParse ? db.safeJsonParse(roleRewards, []) : JSON.parse(roleRewards);
      }

      if (Array.isArray(roleRewards) && roleRewards.length > 0) {
        const sortedRewards = [...roleRewards].sort((a, b) => parseInt(a.days, 10) - parseInt(b.days, 10));
        const upcoming = sortedRewards.find((r) => parseInt(r.days, 10) > currentStreak);
        if (upcoming) {
          const daysLeft = parseInt(upcoming.days, 10) - currentStreak;
          nextMilestoneText = `<@&${upcoming.role_id}> بعد **${daysLeft}** ${daysLeft === 1 ? 'يوم' : 'أيام'}`;
        } else {
          nextMilestoneText = '{emoji:star} وصلت لجميع رتب الستريك المتاحة حالياً';
        }
      }

      const embed = new EmbedBuilder()
        .setColor(currentStreak > 0 ? '#f59e0b' : '#64748b')
        .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
        .setTitle(`{emoji:flame} سلسلة النشاط ${targetUser.username}`)
        .addFields(
          {
            name: '{emoji:flame} الستريك الحالي',
            value: `\`${currentStreak}\` ${currentStreak === 1 ? 'يوم' : 'أيام'} متتالية`,
            inline: true
          },
          {
            name: '{emoji:trophy} أعلى ستريك محقق',
            value: `\`${highestStreak}\` ${highestStreak === 1 ? 'يوم' : 'أيام'}`,
            inline: true
          },
          { name: '{emoji:lock} حماية الستريك', value: `\`${freezes}\` متبقية`, inline: true },
          { name: '{emoji:clock} آخر نشاط مسجل', value: lastActiveTime, inline: true },
          { name: '{emoji:gift} الرتبة القادمة', value: nextMilestoneText, inline: true },
          {
            name: '{emoji:bolt} حالة النظام بالسيرفر',
            value: settings.enabled ? '{emoji:circlecheck} مفعّل ومتاح' : '{emoji:circlex} معطل حالياً',
            inline: true
          }
        )
        .setFooter({ text: `سيرفر ${guild.name}` })
        .setTimestamp();

      return await interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('[Slash Command Error - streak.js]:', err);
      return interaction
        .reply({ content: '{emoji:circlex} حدث خطأ أثناء جلب بيانات الستريك', ephemeral: true })
        .catch(() => null);
    }
  }
};
