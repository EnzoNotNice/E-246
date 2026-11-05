const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const db = require('../../database/db');
const { checkLevelUp } = require('../../utils/levels');
const logger = require('../../utils/logger');

const QUEST_DEFINITIONS = [
  {
    id: 'chat',
    title: '💬 متحدث السيرفر (Chat Activity)',
    description: 'أرسل 20 رسالة في قنوات السيرفر',
    target: 20,
    unit: 'رسالة',
    rewardCredits: 1000,
    rewardXP: 250
  },
  {
    id: 'voice',
    title: '🎙️ رواد الصوتيات (Voice Activity)',
    description: 'اقضِ 15 دقيقة داخل الرومات الصوتية',
    target: 900, // 900 seconds = 15 minutes
    unit: 'دقيقة',
    formatCurrent: (s) => Math.floor(s / 60),
    formatTarget: (s) => Math.floor(s / 60),
    rewardCredits: 1500,
    rewardXP: 350
  },
  {
    id: 'transfer',
    title: '💸 كرم المعاملات (Credit Transfer)',
    description: 'قم بتحويل رصيد كريدت لصديق عبر #credits',
    target: 1,
    unit: 'عملية',
    rewardCredits: 500,
    rewardXP: 150
  },
  {
    id: 'daily',
    title: '🔥 الالتزام اليومي (Daily Bonus)',
    description: 'احصل على مكافأة الكريدت اليومية عبر /daily أو #daily',
    target: 1,
    unit: 'مطالبة',
    rewardCredits: 800,
    rewardXP: 200
  }
];

function makeProgressBar(current, target) {
  const ratio = Math.min(Math.max(current / target, 0), 1);
  const percent = Math.round(ratio * 100);
  const totalBars = 10;
  const filledBars = Math.round(ratio * totalBars);
  const bar = '█'.repeat(filledBars) + '░'.repeat(totalBars - filledBars);
  return `\`[${bar}]\` **${percent}%**`;
}

function buildQuestsEmbed(user, questData) {
  const fields = [];
  let completedCount = 0;
  let claimableCount = 0;

  for (const q of QUEST_DEFINITIONS) {
    const rawVal = questData.progress?.[q.id] || 0;
    const isClaimed = Boolean(questData.claimed?.[q.id]);
    const isCompleted = rawVal >= q.target;

    if (isCompleted) completedCount++;
    if (isCompleted && !isClaimed) claimableCount++;

    const dispCurrent = q.formatCurrent ? q.formatCurrent(rawVal) : rawVal;
    const dispTarget = q.formatTarget ? q.formatTarget(q.target) : q.target;
    const cappedCurrent = Math.min(dispCurrent, dispTarget);

    const progressBar = makeProgressBar(rawVal, q.target);

    let statusText = '';
    if (isClaimed) {
      statusText = '✅ **تم استلام المكافأة**';
    } else if (isCompleted) {
      statusText = '🟢 **جاهز للاستلام! اضغط الزر أدناه**';
    } else {
      statusText = `⏳ **قيد الإنجاز** (${cappedCurrent}/${dispTarget} ${q.unit})`;
    }

    fields.push({
      name: q.title,
      value:
        `${q.description}\n` +
        `• التقدم: ${progressBar} (${cappedCurrent}/${dispTarget} ${q.unit})\n` +
        `• المكافأة: \`$${q.rewardCredits.toLocaleString()}\` كريدت + \`${q.rewardXP}\` XP\n` +
        `• الحالة: ${statusText}`,
      inline: false
    });
  }

  const embed = new EmbedBuilder()
    .setColor(claimableCount > 0 ? 0x57f287 : 0x5865f2)
    .setAuthor({
      name: `مهام اليوم لـ ${user.displayName || user.username}`,
      iconURL: user.displayAvatarURL()
    })
    .setTitle('📋 المهام اليومية (Daily Quests)')
    .setDescription(
      `أكمل مهامك اليومية واكسب رصيد كريدت ونقاط خبرة (XP) إضافية!\n` +
        `تتجدد جميع المهام يومياً في تمام الساعة 00:00 UTC.\n\n` +
        `🏆 **المهام المكتملة:** \`${completedCount} / ${QUEST_DEFINITIONS.length}\``
    )
    .addFields(fields)
    .setFooter({ text: 'E-246 Daily Quests System • اضغط زر الاستلام لأخذ مكافآتك' })
    .setTimestamp();

  return { embed, claimableCount };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quests')
    .setDescription('عرض واستلام مكافآت المهام اليومية للكريدت والخبرة (XP)'),

  async execute(interaction) {
    try {
      const user = interaction.user;
      const userId = user.id;
      const guildId = interaction.guildId;
      const channelId = interaction.channelId;

      const dateStr = new Date().toISOString().slice(0, 10);
      const questData = db.getDailyQuests(userId, dateStr);

      const { embed, claimableCount } = buildQuestsEmbed(user, questData);

      const claimBtn = new ButtonBuilder()
        .setCustomId(`quests_claim_${userId}`)
        .setLabel(claimableCount > 0 ? `🎁 استلام المكافآت (${claimableCount})` : '🎁 لا توجد مكافآت جاهزة')
        .setStyle(claimableCount > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(claimableCount === 0);

      const refreshBtn = new ButtonBuilder()
        .setCustomId(`quests_refresh_${userId}`)
        .setLabel('🔄 تحديث')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(claimBtn, refreshBtn);

      const response = await interaction.reply({
        embeds: [embed],
        components: [row]
      });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === userId && i.customId.startsWith('quests_'),
        time: 120000
      });

      collector.on('collect', async (btnInteraction) => {
        try {
          const freshQuestData = db.getDailyQuests(userId, dateStr);

          if (btnInteraction.customId === `quests_refresh_${userId}`) {
            const updated = buildQuestsEmbed(user, freshQuestData);
            claimBtn
              .setLabel(
                updated.claimableCount > 0
                  ? `🎁 استلام المكافآت (${updated.claimableCount})`
                  : '🎁 لا توجد مكافآت جاهزة'
              )
              .setStyle(updated.claimableCount > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setDisabled(updated.claimableCount === 0);

            return btnInteraction.update({
              embeds: [updated.embed],
              components: [new ActionRowBuilder().addComponents(claimBtn, refreshBtn)]
            });
          }

          if (btnInteraction.customId === `quests_claim_${userId}`) {
            let totalCreditsGained = 0;
            let totalXpGained = 0;
            const claimedNames = [];

            for (const q of QUEST_DEFINITIONS) {
              const currentVal = freshQuestData.progress?.[q.id] || 0;
              const isClaimed = Boolean(freshQuestData.claimed?.[q.id]);

              if (currentVal >= q.target && !isClaimed) {
                totalCreditsGained += q.rewardCredits;
                totalXpGained += q.rewardXP;
                claimedNames.push(q.title);
                db.claimDailyQuest(userId, q.id, dateStr);
              }
            }

            if (totalCreditsGained === 0 && totalXpGained === 0) {
              return btnInteraction.reply({
                content: '❌ لا توجد أي مكافآت مكتملة جاهزة للاستلام حالياً.',
                ephemeral: true
              });
            }

            // Award credits
            const curBalance = (await db.getKV(`balance_${userId}`)) || 0;
            const newBalance = curBalance + totalCreditsGained;
            await db.setKV(`balance_${userId}`, newBalance);

            // Award XP & check level
            db.addXP(userId, guildId, totalXpGained);
            await checkLevelUp(interaction.client, userId, guildId, channelId).catch(() => null);

            // Update quests embed
            const finalQuestData = db.getDailyQuests(userId, dateStr);
            const finalStatus = buildQuestsEmbed(user, finalQuestData);

            claimBtn.setLabel('✅ تم استلام جميع المكافآت').setStyle(ButtonStyle.Secondary).setDisabled(true);

            await btnInteraction.update({
              embeds: [finalStatus.embed],
              components: [new ActionRowBuilder().addComponents(claimBtn, refreshBtn)]
            });

            return btnInteraction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x57f287)
                  .setTitle('🎉 تم استلام مكافآت المهام اليومية!')
                  .setDescription(
                    `مبروك! تم استلام مكافأة المهام:\n` +
                      `${claimedNames.map((n) => `• ${n}`).join('\n')}\n\n` +
                      `💰 **الكريدت المكتسب:** \`+$${totalCreditsGained.toLocaleString()}\` (رصيدك الجديد: \`$${newBalance.toLocaleString()}\`)\n` +
                      `⚡ **الخبرة المكتسبة:** \`+${totalXpGained.toLocaleString()}\` XP`
                  )
              ],
              ephemeral: true
            });
          }
        } catch (err) {
          logger.error('[Quests Button Collect Error]:', err);
          const replyPayload = { content: '❌ حدث خطأ أثناء معالجة طلبك.', flags: ['Ephemeral'] };
          if (btnInteraction.replied || btnInteraction.deferred) {
            return btnInteraction.followUp(replyPayload).catch(() => null);
          } else {
            return btnInteraction.reply(replyPayload).catch(() => null);
          }
        }
      });

      collector.on('end', () => {
        claimBtn.setDisabled(true);
        refreshBtn.setDisabled(true);
        interaction
          .editReply({ components: [new ActionRowBuilder().addComponents(claimBtn, refreshBtn)] })
          .catch(() => null);
      });
    } catch (err) {
      logger.error('[Quests Command Error]:', err);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: '❌ حدث خطأ أثناء عرض المهام.' }).catch(() => null);
      }
      return interaction.reply({ content: '❌ حدث خطأ أثناء عرض المهام.', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
