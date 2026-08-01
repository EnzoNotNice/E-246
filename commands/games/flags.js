const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { success } = require('../../utils/embeds');
const logger = require('../../utils/logger');

const activeGames = new Set();

const flagsData = [
  { code: 'sa', names: ['السعودية', 'المملكة العربية السعودية', 'saudi arabia', 'saudi'] },
  { code: 'eg', names: ['مصر', 'جمهورية مصر العربية', 'egypt'] },
  { code: 'ma', names: ['المغرب', 'morocco'] },
  { code: 'dz', names: ['الجزائر', 'algeria'] },
  { code: 'tn', names: ['تونس', 'tunisia'] },
  { code: 'jp', names: ['اليابان', 'japan'] },
  { code: 'kr', names: ['كوريا الجنوبية', 'south korea', 'korea'] },
  { code: 'cn', names: ['الصين', 'china'] },
  { code: 'fr', names: ['فرنسا', 'france'] },
  { code: 'de', names: ['ألمانيا', 'germany'] },
  { code: 'gb', names: ['بريطانيا', 'المملكة المتحدة', 'uk', 'united kingdom', 'england'] },
  { code: 'us', names: ['أمريكا', 'الولايات المتحدة', 'الولايات المتحدة الأمريكية', 'usa', 'united states'] },
  { code: 'it', names: ['إيطاليا', 'italy'] },
  { code: 'es', names: ['إسبانيا', 'spain'] },
  { code: 'br', names: ['البرازيل', 'brazil'] },
  { code: 'ar', names: ['الأرجنتين', 'الارجنتين', 'argentina'] },
  { code: 'ca', names: ['كندا', 'canada'] },
  { code: 'au', names: ['أستراليا', 'استراليا', 'australia'] },
  { code: 'ru', names: ['روسيا', 'russia'] },
  { code: 'in', names: ['الهند', 'india'] },
  { code: 'tr', names: ['تركيا', 'turkey'] },
  { code: 'mx', names: ['المكسيك', 'mexico'] },
  { code: 'za', names: ['جنوب أفريقيا', 'جنوب افريقيا', 'south africa'] },
  { code: 'sg', names: ['سنغافورة', 'singapore'] },
  { code: 'ch', names: ['سويسرا', 'switzerland'] },
  { code: 'se', names: ['السويد', 'sweden'] },
  { code: 'no', names: ['النرويج', 'norway'] },
  { code: 'nl', names: ['هولندا', 'netherlands'] },
  { code: 'be', names: ['بلجيكا', 'belgium'] },
  { code: 'ua', names: ['أوكرانيا', 'اوكرانيا', 'ukraine'] },
  { code: 'pt', names: ['البرتغال', 'portugal'] },
  { code: 'gr', names: ['اليونان', 'greece'] }
];

module.exports = {
  subcommand: new SlashCommandSubcommandBuilder().setName('flags').setDescription('لعبة تخمين أعلام الدول 5 جولات'),

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
        logger.error('[flags] Failed to load emojis.json:', e.message);
      }

      const starEmoji = emojis.star || '⭐';
      const trophyEmoji = emojis.trophy || '🏆';

      await interaction.deferReply().catch(() => null);

      await interaction.editReply({
        embeds: [
          success(
            `🚩 **لعبة أعلام الدول**`,
            `ستبدأ اللعبة الآن تتكون اللعبة من 5 جولات\nأول من يكتب اسم الدولة الصحيح في الشات يفوز بنقطة الجولة\n\n⏱️ الاستعداد للجولة الأولى بعد قليل`
          )
        ]
      });

      const scores = {}; // userId => points
      const userTags = {}; // userId => username

      // Shuffle flags list
      const gameFlags = [...flagsData].sort(() => Math.random() - 0.5).slice(0, 5);

      for (let round = 0; round < 5; round++) {
        await new Promise((resolve) => setTimeout(resolve, 4000));

        const currentFlagData = gameFlags[round];
        const flagUrl = `https://flagcdn.com/w640/${currentFlagData.code}.png`;
        const correctNames = currentFlagData.names;

        const roundEmbed = new EmbedBuilder()
          .setTitle(`${starEmoji} تخمين العلم - الجولة [${round + 1} من 5]`)
          .setDescription(
            `ما هي الدولة صاحبة هذا العلم المعروض في الصورة أدناه؟ اكتب اسم الدولة في الشات بسرعة\n\n⏱️ لديك 20 ثانية للتخمين`
          )
          .setImage(flagUrl)
          .setColor(0x8c52ff);

        const roundMsg = await interaction.channel.send({ embeds: [roundEmbed] }).catch(() => null);
        if (!roundMsg) break;

        const filter = (m) => {
          if (m.author.bot) return false;
          const guess = m.content.trim().toLowerCase();
          return correctNames.some((name) => guess === name.toLowerCase());
        };

        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });
        let roundEnded = false;

        await new Promise((resolve) => {
          collector.on('collect', async (m) => {
            roundEnded = true;
            const author = m.author;
            scores[author.id] = (scores[author.id] || 0) + 1;
            userTags[author.id] = author.username;

            await m
              .reply(`✅ **إجابة صحيحة من <@${author.id}>** الدولة هي **${correctNames[0]}** 🎉`)
              .catch(() => null);
            collector.stop('correct_answer');
            resolve();
          });

          collector.on('end', async (collected, reason) => {
            if (reason === 'time' && !roundEnded) {
              await interaction.channel
                .send(`⏰ **انتهى الوقت** لم يعرف أحد العلم\nالدولة الصحيحة هي **${correctNames[0]}**`)
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
        .setTitle(`${trophyEmoji} انتهت لعبة الأعلام`)
        .setDescription(`🏆 **النتائج النهائية للمتسابقين**\n\n${desc}`)
        .setColor(0xffff00)
        .setTimestamp();

      await interaction.channel.send({ embeds: [endEmbed] }).catch(() => null);
    } catch (err) {
      logger.error('[Command Error - flags.js]:', err);
      activeGames.delete(interaction.channelId);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ لعبة الأعلام.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
