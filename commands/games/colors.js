const logger = require('../../utils/logger');
const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder
} = require('discord.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { success } = require('../../utils/embeds');

const activeGames = new Set();

const colorsData = [
  { name: 'فيروزي', hex: '#30D5C8', options: ['سماوي', 'فيروزي', 'لازوردي', 'زبرجدي', 'نيلي'] },
  { name: 'قرمزي', hex: '#DC143C', options: ['عنابي', 'قرمزي', 'كرزي', 'خوخي', 'أرجواني'] },
  { name: 'زمردي', hex: '#50C878', options: ['فستقي', 'زمردي', 'زيتوني', 'عشبي', 'ليموني'] },
  { name: 'خردلي', hex: '#FFDB58', options: ['ليموني', 'مشمشي', 'خردلي', 'ذهبي', 'عسلي'] },
  { name: 'لازوردي', hex: '#007FFF', options: ['كحلي', 'سماوي', 'لازوردي', 'بترولي', 'نيلي'] },
  { name: 'ليلكي', hex: '#C8A2C8', options: ['وردي', 'ليلكي', 'بنفسجي', 'خوخي', 'بمبي'] },
  { name: 'بترولي', hex: '#005F73', options: ['كحلي', 'بترولي', 'زيتوني', 'فيروزي', 'رمادي'] },
  { name: 'مرجاني', hex: '#FF7F50', options: ['برتقالي', 'مشمشي', 'مرجاني', 'وردي', 'خوخي'] },
  { name: 'زبرجدي', hex: '#708238', options: ['فستقي', 'زيتوني', 'زبرجدي', 'زمردي', 'عشبي'] },
  { name: 'عنباري', hex: '#FFBF00', options: ['ذهبي', 'عسلي', 'عنباري', 'خردلي', 'مشمشي'] },
  { name: 'لاوندر', hex: '#E6E6FA', options: ['أبيض', 'وردي', 'لاوندر', 'ليلكي', 'رمادي'] },
  { name: 'فستقي', hex: '#BEF574', options: ['زمردي', 'عشبي', 'ليموني', 'فستقي', 'زيتوني'] },
  { name: 'أرجواني', hex: '#800080', options: ['قرمزي', 'ليلكي', 'أرجواني', 'عنابي', 'خوخي'] },
  { name: 'طوبي', hex: '#B22222', options: ['قرمزي', 'طوبي', 'عنابي', 'بني', 'برتقالي'] },
  { name: 'عسلي', hex: '#C2B280', options: ['ذهبي', 'عسلي', 'خردلي', 'مشمشي', 'كاكي'] }
];

module.exports = {
  subcommand: new SlashCommandSubcommandBuilder()
    .setName('colors')
    .setDescription('لعبة تخمين الألوان الصعبة والغريبة'),

  async execute(interaction) {
    try {
      if (activeGames.has(interaction.channelId)) {
        return interaction.reply({ content: '❌ هناك لعبة جارية في هذا الروم حالياً.', flags: ['Ephemeral'] });
      }

      activeGames.add(interaction.channelId);

      let emojis = {};
      try {
        const fileContent = fs.readFileSync(path.join(__dirname, '../../utils/emojis.json'), 'utf8');
        emojis = JSON.parse(fileContent);
      } catch (e) {
        logger.error('[colors] Failed to load emojis.json:', e.message);
      }

      const starEmoji = emojis.star || '⭐';
      const trophyEmoji = emojis.trophy || '🏆';

      await interaction.deferReply().catch(() => null);

      await interaction.editReply({
        embeds: [
          success(
            `🎨 **لعبة تخمين الألوان الصعبة**`,
            `ستبدأ اللعبة الآن تتكون اللعبة من 5 جولات\nانظر إلى لون الصورة المعروضة واختر اسم اللون الصحيح من الأزرار\n\n⏱️ الاستعداد للجولة الأولى بعد قليل`
          )
        ]
      });

      const scores = {}; // userId => points
      const gameColors = [...colorsData].sort(() => Math.random() - 0.5).slice(0, 5);

      for (let round = 0; round < 5; round++) {
        await new Promise((resolve) => setTimeout(resolve, 4000));

        const currentColor = gameColors[round];
        const correctName = currentColor.name;

        // Shuffle choices options
        const choices = [...currentColor.options].sort(() => Math.random() - 0.5);

        const choiceBtns = choices.map((choice, idx) => {
          return new ButtonBuilder()
            .setCustomId(`color_${round}_${idx}_${choice === correctName ? 'correct' : 'wrong'}`)
            .setLabel(choice)
            .setStyle(ButtonStyle.Secondary);
        });

        const row = new ActionRowBuilder().addComponents(choiceBtns);

        // Generate solid color image buffer
        let attachment;
        try {
          const canvas = createCanvas(300, 120);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = currentColor.hex;
          ctx.fillRect(0, 0, 300, 120);
          const buffer = canvas.toBuffer();
          attachment = new AttachmentBuilder(buffer, { name: 'color.png' });
        } catch (canvasErr) {
          logger.error('[colors] Canvas image generation failed:', canvasErr);
        }

        const roundEmbed = new EmbedBuilder()
          .setTitle(`${starEmoji} تخمين اللون - الجولة [${round + 1} من 5]`)
          .setDescription(`ما هو اسم هذا اللون المعروض في الصورة أدناه؟\n\n⏱️ لديك 15 ثانية للإجابة!`)
          .setColor(currentColor.hex);

        if (attachment) {
          roundEmbed.setImage('attachment://color.png');
        }

        const sendPayload = { embeds: [roundEmbed], components: [row] };
        if (attachment) {
          sendPayload.files = [attachment];
        }

        const roundMsg = await interaction.channel.send(sendPayload).catch(() => null);
        if (!roundMsg) break;

        const collector = roundMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15000
        });
        const clickedUsers = new Set();
        let roundEnded = false;

        await new Promise((resolve) => {
          collector.on('collect', async (i) => {
            if (clickedUsers.has(i.user.id)) {
              return i
                .reply({ content: '❌ لقد شاركت بالفعل في هذه الجولة بأجوبة خاطئة', flags: ['Ephemeral'] })
                .catch(() => null);
            }

            const isCorrect = i.customId.endsWith('correct');

            if (isCorrect) {
              roundEnded = true;
              scores[i.user.id] = (scores[i.user.id] || 0) + 1;

              await i
                .reply({ content: `🎉 **إجابة صحيحة** لقد كسبت نقطة الجولة`, flags: ['Ephemeral'] })
                .catch(() => null);
              await interaction.channel
                .send(`✅ **<@${i.user.id}> إجابة صحيحة** اللون المعروض هو **${correctName}** 🎉`)
                .catch(() => null);

              collector.stop('correct_answer');
              resolve();
            } else {
              clickedUsers.add(i.user.id);
              await i
                .reply({
                  content: `❌ **إجابة خاطئة** لقد تم استبعادك من المحاولات في هذه الجولة`,
                  flags: ['Ephemeral']
                })
                .catch(() => null);
            }
          });

          collector.on('end', async (collected, reason) => {
            // Disable buttons
            const disabledBtns = choiceBtns.map((btn) => ButtonBuilder.from(btn).setDisabled(true));
            const disabledRow = new ActionRowBuilder().addComponents(disabledBtns);
            await roundMsg.edit({ components: [disabledRow] }).catch(() => null);

            if (reason === 'time' && !roundEnded) {
              await interaction.channel
                .send(`⏰ **انتهى الوقت** لم ينجح أحد في تخمين اللون\nاللون الصحيح كان **${correctName}** 🎨`)
                .catch(() => null);
              resolve();
            }
          });
        });
      }

      // Game Ended - Render Leaderboard
      activeGames.delete(interaction.channelId);

      const sortedLeaderboard = Object.entries(scores).sort((a, b) => b[1] - a[1]);

      let desc = '';
      if (sortedLeaderboard.length === 0) {
        desc = '😔 لم يتمكن أحد من كسب أي نقاط في هذه اللعبة';
      } else {
        desc = sortedLeaderboard
          .map(([userId, pts], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▪️';
            return `${medal} <@${userId}> — **${pts}** نقطة`;
          })
          .join('\n');
      }

      const endEmbed = new EmbedBuilder()
        .setTitle(`${trophyEmoji} انتهت لعبة الألوان`)
        .setDescription(`🏆 **النتائج النهائية للمتسابقين**\n\n${desc}`)
        .setColor(0xffff00)
        .setTimestamp();

      await interaction.channel.send({ embeds: [endEmbed] }).catch(() => null);
    } catch (err) {
      logger.error('[Command Error - colors.js]:', err);
      activeGames.delete(interaction.channelId);
      if (interaction && !interaction.replied && interaction.deferred) {
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ لعبة الألوان' }).catch(() => null);
      } else if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ لعبة الألوان', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
