const logger = require('../../utils/logger');
const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const activeGames = new Set();

const subjects = [
  { category: 'حيوانات 🦁', word: 'أسد', options: ['نمر', 'فهد', 'قطة', 'ذئب'] },
  { category: 'حيوانات 🦁', word: 'كلب', options: ['قطة', 'ذئب', 'ثعلب', 'أسد'] },
  { category: 'حيوانات 🦁', word: 'فيل', options: ['زرافة', 'خرتيت', 'نمر', 'حمار وحشي'] },
  { category: 'أطعمة 🍕', word: 'بيتزا', options: ['برجر', 'شاورما', 'باستا', 'سوشي'] },
  { category: 'أطعمة 🍕', word: 'شاورما', options: ['فلافل', 'بيتزا', 'كبسة', 'برجر'] },
  { category: 'أطعمة 🍕', word: 'كبسة', options: ['شاورما', 'منسف', 'برياني', 'بخاري'] },
  { category: 'وظائف 💼', word: 'طبيب', options: ['مهندس', 'محامي', 'محاسب', 'مدرس'] },
  { category: 'وظائف 💼', word: 'طيار', options: ['مضيف طيران', 'طبيب', 'سائق قطار', 'بحار'] },
  { category: 'وظائف 💼', word: 'معلم', options: ['مدير', 'طبيب', 'مهندس', 'بروفيسور'] },
  { category: 'أماكن 🏢', word: 'مستشفى', options: ['صيدلية', 'مدرسة', 'مستوصف', 'عيادة'] },
  { category: 'أماكن 🏢', word: 'مطار', options: ['محطة قطار', 'ميناء', 'فندق', 'مستشفى'] },
  { category: 'أماكن 🏢', word: 'مدرسة', options: ['جامعة', 'معهد', 'مكتبة', 'مستشفى'] },
  { category: 'أغراض 📱', word: 'جوال', options: ['ساعة', 'لابتوب', 'شاحن', 'سماعات'] },
  { category: 'أغراض 📱', word: 'سيارة', options: ['دراجة', 'سفينة', 'طائرة', 'قطار'] },
  { category: 'أغراض 📱', word: 'قلم', options: ['دفتر', 'كتاب', 'مسطرة', 'ممحاة'] }
];

module.exports = {
  subcommand: new SlashCommandSubcommandBuilder().setName('salfa').setDescription('لعبة برة السالفة الجماعية'),

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
        logger.error('[salfa] Failed to load emojis.json:', e.message);
      }

      const starEmoji = emojis.star || '⭐';
      const clockEmoji = emojis.clock || '⏱️';

      const host = interaction.user;
      let players = [{ id: host.id, name: host.username }];

      const embed = new EmbedBuilder()
        .setTitle(`${starEmoji} لعبة برة السالفة`)
        .setDescription(
          `**نبذة عن اللعبة**\nلعبة جماعية يُخفى فيها شيء ما عن أحد اللاعبين الذي هو (برة السالفة) بينما يعرفه اللاعبون الآخرون (جوة السالفة)\nيطرح اللاعبون أسئلة ذكية حول الشيء لمعرفة الشخص الذي هو (برة السالفة) بينما يحاول الأخير التضليل والتخمين\n\n${clockEmoji} **لديك 30 ثانية للانضمام (مطلوب 4 لاعبين على الأقل)**`
        )
        .setColor(0x8c52ff)
        .addFields({ name: `اللاعبون (${players.length})`, value: `<@${host.id}>` });

      const joinBtn = new ButtonBuilder().setCustomId('s_join').setLabel('دخول للعبة').setStyle(ButtonStyle.Success);
      const leaveBtn = new ButtonBuilder().setCustomId('s_leave').setLabel('خروج').setStyle(ButtonStyle.Danger);
      const startBtn = new ButtonBuilder().setCustomId('s_start').setLabel('بدء اللعبة').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn, startBtn);

      await interaction.deferReply().catch(() => null);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const joinCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

      joinCollector.on('collect', async (i) => {
        if (i.customId === 's_join') {
          if (players.some((p) => p.id === i.user.id)) {
            return i.reply({ content: 'أنت مشارك بالفعل في اللعبة', flags: ['Ephemeral'] }).catch(() => null);
          }
          if (players.length >= 20) {
            return i
              .reply({ content: 'عذراً اكتمل العدد الأقصى للعبة (20 لاعب)', flags: ['Ephemeral'] })
              .catch(() => null);
          }
          players.push({ id: i.user.id, name: i.user.username, interaction: i });
          await i.reply({ content: 'تم انضمامك للعبة بنجاح 🎉', flags: ['Ephemeral'] }).catch(() => null);
        } else if (i.customId === 's_leave') {
          if (!players.some((p) => p.id === i.user.id)) {
            return i.reply({ content: 'أنت لست مشاركاً في اللعبة لتخرج منها', flags: ['Ephemeral'] }).catch(() => null);
          }
          if (i.user.id === host.id) {
            return i.reply({ content: 'لا يمكنك الخروج بصفتك منشئ اللعبة', flags: ['Ephemeral'] }).catch(() => null);
          }
          players = players.filter((p) => p.id !== i.user.id);
          await i.reply({ content: 'تم خروجك من اللعبة', flags: ['Ephemeral'] }).catch(() => null);
        } else if (i.customId === 's_start') {
          if (i.user.id !== host.id) {
            return i
              .reply({ content: 'منشئ اللعبة فقط هو من يستطيع بدء اللعبة قبل انتهاء الوقت', flags: ['Ephemeral'] })
              .catch(() => null);
          }
          if (players.length < 4) {
            return i
              .reply({ content: 'لا يمكن بدء اللعبة يجب وجود 4 لاعبين على الأقل', flags: ['Ephemeral'] })
              .catch(() => null);
          }
          await i.reply({ content: 'تم بدء اللعبة وتوزيع الأدوار بنجاح 🎉', flags: ['Ephemeral'] }).catch(() => null);
          const hostPlayer = players.find((p) => p.id === host.id);
          if (hostPlayer) {
            hostPlayer.interaction = i;
          }
          joinCollector.stop('host_start');
          return;
        }

        const playersText = players.map((p) => `<@${p.id}>`).join('\n');
        const newEmbed = EmbedBuilder.from(embed).setFields({
          name: `اللاعبون (${players.length})`,
          value: playersText
        });
        await msg.edit({ embeds: [newEmbed] }).catch(() => null);
      });

      joinCollector.on('end', async () => {
        if (players.length < 4) {
          activeGames.delete(interaction.channelId);
          const failEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setDescription(
              `❌ تم إلغاء اللعبة لعدم انضمام العدد الكافي من اللاعبين (المطلوب 4 على الأقل انضم: ${players.length})`
            );
          return msg.edit({ embeds: [failEmbed], components: [] }).catch(() => null);
        }

        // Disable joining buttons
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(joinBtn).setDisabled(true),
          ButtonBuilder.from(leaveBtn).setDisabled(true),
          ButtonBuilder.from(startBtn).setDisabled(true)
        );
        await msg.edit({ components: [disabledRow] }).catch(() => null);

        // Setup Game Roles
        const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
        const undercoverIndex = Math.floor(Math.random() * players.length);
        const undercoverPlayer = players[undercoverIndex];

        // Automatically edit ephemeral replies to show roles to players
        for (const p of players) {
          if (p.interaction) {
            const isUndercover = p.id === undercoverPlayer.id;
            let roleText = '';
            if (isUndercover) {
              roleText = `🕵️ **دورك:** أنت **برة السالفة**\n🗂️ **التصنيف العام هو** \`${randomSubject.category}\`\n⚠️ لا تعرف الشيء السري راقب أسئلة وإجابات الآخرين بدقة لاستنتاجه وتضليلهم لتكسب نقطة`;
            } else {
              roleText = `🕵️ **دورك:** أنت **جوة السالفة**\n📦 **الشيء السري هو** \`${randomSubject.word}\`\n🗂️ **التصنيف** \`${randomSubject.category}\`\n💬 اطرح أسئلة تلميحية ذكية لتكشف الشخص الذي هو (برة السالفة) دون كشف الكلمة له`;
            }
            await p.interaction
              .editReply({ content: `تم انضمامك للعبة بنجاح 🎉\n\n${roleText}`, flags: ['Ephemeral'] })
              .catch(() => null);
          }
        }

        // Announcement of roles
        const gameStartEmbed = new EmbedBuilder()
          .setTitle(`${starEmoji} بدأت اللعبة - لعبة برة السالفة`)
          .setDescription(
            `🤫 **تم توزيع الأدوار سرياً**\nلقد تم إرسال دورك والكلمة السرية في رسالة مخفية بالرد على انضمامك!`
          )
          .setColor(0x00e676);

        const gameMsg = await interaction.channel.send({ embeds: [gameStartEmbed] }).catch(() => null);
        if (!gameMsg) {
          activeGames.delete(interaction.channelId);
          return;
        }

        // Setup questioning and rounds loop
        let activePlayers = [...players];
        let roundNum = 1;

        async function runRound() {
          if (!activeGames.has(interaction.channelId)) return;

          if (activePlayers.length <= 2) {
            // Undercover wins because innocents can no longer vote them out
            activeGames.delete(interaction.channelId);
            const escapeEmbed = new EmbedBuilder()
              .setTitle(`🎭 فاز برة السالفة بالخداع`)
              .setDescription(
                `لم يتبق سوى لاعبين اثنين في اللعبة\n\nالشخص الحقيقي الذي كان **برة السالفة** هو <@${undercoverPlayer.id}>\nوالشيء السري كان **${randomSubject.word}**\n\n🏆 فاز <@${undercoverPlayer.id}> بالجولة بنجاحه في تضليلكم`
              )
              .setColor(0xef4444);
            await interaction.channel.send({ embeds: [escapeEmbed] }).catch(() => null);
            return;
          }

          // 1. Announce Round Start
          const roundStartEmbed = new EmbedBuilder()
            .setTitle(`🎮 الجولة ${roundNum} - طرح الأسئلة`)
            .setDescription(
              `سيقوم البوت الآن بطرح سؤال على كل لاعب بالتناوب حول الشيء السري\nيرجى الإجابة في الشات بذكاء وتجنب كشف الكلمة للعدو`
            )
            .setColor(0x8c52ff);
          await interaction.channel.send({ embeds: [roundStartEmbed] }).catch(() => null);

          // 2. Questions sequence
          const generalQuestions = [
            'هل هذا الشيء يؤكل أو يشرب عادة؟',
            'أين نجد هذا الشيء أو نراه في حياتنا اليومية؟',
            'ما هو حجم هذا الشيء تقريباً (كبير، متوسط، صغير)؟',
            'هل هذا الشيء كائن حي أم جماد؟',
            'هل هو مفيد للإنسان أم للتسلية والترفيه فقط؟',
            'هل هو خفيف الوزن ويمكن حمله باليد بسهولة؟',
            'هل نراه داخل المنزل عادة أم في الأماكن المفتوحة بالخارج؟',
            'هل يتوفر بألوان وأشكال متعددة أم بلون واحد؟',
            'هل نستخدمه بشكل يومي مستمر أم في مناسبات معينة؟',
            'هل هو طبيعي من خلق الطبيعة أم صناعي من صنع البشر؟'
          ];

          const questionOrder = [...activePlayers].sort(() => Math.random() - 0.5);

          for (const p of questionOrder) {
            if (!activeGames.has(interaction.channelId)) return;

            const randomQ = generalQuestions[Math.floor(Math.random() * generalQuestions.length)];
            const qEmbed = new EmbedBuilder()
              .setTitle(`💬 سؤال لـ ${p.name}`)
              .setDescription(
                `يا <@${p.id}> ما هي إجابتك على السؤال التالي\n\n**${randomQ}**\n\n⏱️ اكتب إجابتك في الشات بسرعة (لديك 30 ثانية)`
              )
              .setColor(0xff8f00);

            await interaction.channel.send({ embeds: [qEmbed] }).catch(() => null);

            const filter = (m) => m.author.id === p.id && !m.author.bot;
            try {
              const collected = await interaction.channel.awaitMessages({
                filter,
                max: 1,
                time: 30000,
                errors: ['time']
              });
              const userReply = collected.first();
              if (userReply) {
                await userReply.reply(`✅ تم تسجيل إجابتك`).catch(() => null);
              }
            } catch (err) {
              await interaction.channel.send(`⏰ انتهى الوقت ولم يجب اللاعب <@${p.id}>`).catch(() => null);
            }

            // Small delay between questions
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

          // 3. Start Voting Phase for this round
          if (!activeGames.has(interaction.channelId)) return;

          const voteEmbed = new EmbedBuilder()
            .setTitle(`🗳️ تصويت الجولة ${roundNum}`)
            .setDescription(
              `الرجاء التصويت للشخص الذي تعتقدون أنه **برة السالفة** من خلال قائمة الاختيار أدناه\nلديك 45 ثانية للتصويت`
            )
            .setColor(0xff8f00);

          const selectOptions = activePlayers.map((p) => ({
            label: p.name,
            value: p.id,
            description: `التصويت ضد ${p.name}`
          }));

          const voteSelect = new StringSelectMenuBuilder()
            .setCustomId('s_vote_select')
            .setPlaceholder('اختر الشخص المتهم...')
            .addOptions(selectOptions);

          const skipBtn = new ButtonBuilder()
            .setCustomId('s_skip_vote')
            .setLabel(`⏭️ تخطي التصويت (0/${activePlayers.length})`)
            .setStyle(ButtonStyle.Secondary);

          const voteRow = new ActionRowBuilder().addComponents(voteSelect);
          const btnRow = new ActionRowBuilder().addComponents(skipBtn);

          const voteMsg = await interaction.channel
            .send({ embeds: [voteEmbed], components: [voteRow, btnRow] })
            .catch(() => null);
          if (!voteMsg) {
            activeGames.delete(interaction.channelId);
            return;
          }

          const voteCollector = voteMsg.createMessageComponentCollector({ time: 45000 });
          const votes = {}; // voterId => votedId
          const votedCount = {};
          const skipVotes = new Set();

          voteCollector.on('collect', async (i) => {
            if (!activePlayers.some((ap) => ap.id === i.user.id)) {
              return i
                .reply({ content: '❌ أنت لست جزءاً من هذه الجولة للتصويت', flags: ['Ephemeral'] })
                .catch(() => null);
            }

            if (i.customId === 's_vote_select') {
              const votedUserId = i.values[0];
              votes[i.user.id] = votedUserId;
              skipVotes.delete(i.user.id);

              const updatedSkipBtn = ButtonBuilder.from(skipBtn).setLabel(
                `⏭️ تخطي التصويت (${skipVotes.size}/${activePlayers.length})`
              );
              const updatedBtnRow = new ActionRowBuilder().addComponents(updatedSkipBtn);
              await voteMsg.edit({ components: [voteRow, updatedBtnRow] }).catch(() => null);

              await i
                .reply({ content: `تم تسجيل تصويتك ضد <@${votedUserId}> بنجاح`, flags: ['Ephemeral'] })
                .catch(() => null);
            } else if (i.customId === 's_skip_vote') {
              if (skipVotes.has(i.user.id)) {
                return i.reply({ content: 'لقد صوتت لتخطي التصويت بالفعل', flags: ['Ephemeral'] }).catch(() => null);
              }

              skipVotes.add(i.user.id);
              delete votes[i.user.id];

              const updatedSkipBtn = ButtonBuilder.from(skipBtn).setLabel(
                `⏭️ تخطي التصويت (${skipVotes.size}/${activePlayers.length})`
              );
              const updatedBtnRow = new ActionRowBuilder().addComponents(updatedSkipBtn);
              await voteMsg.edit({ components: [voteRow, updatedBtnRow] }).catch(() => null);

              await i
                .reply({ content: `تم تسجيل تصويتك لتخطي التصويت في هذه الجولة بنجاح`, flags: ['Ephemeral'] })
                .catch(() => null);

              const majorityNeeded = Math.ceil(activePlayers.length / 2);
              if (skipVotes.size >= majorityNeeded) {
                return voteCollector.stop('skip_vote');
              }
            }

            const totalActed = Object.keys(votes).length + skipVotes.size;
            if (totalActed >= activePlayers.length) {
              voteCollector.stop('all_voted');
            }
          });

          voteCollector.on('end', async (collected, reason) => {
            const disabledVoteSelect = StringSelectMenuBuilder.from(voteSelect).setDisabled(true);
            const disabledVoteRow = new ActionRowBuilder().addComponents(disabledVoteSelect);

            const disabledSkipBtn = ButtonBuilder.from(skipBtn)
              .setDisabled(true)
              .setLabel(`⏭️ تخطي التصويت (${skipVotes.size}/${activePlayers.length})`);
            const disabledBtnRow = new ActionRowBuilder().addComponents(disabledSkipBtn);

            await voteMsg.edit({ components: [disabledVoteRow, disabledBtnRow] }).catch(() => null);

            if (!activeGames.has(interaction.channelId)) return;

            if (reason === 'skip_vote') {
              const skipEmbed = new EmbedBuilder()
                .setTitle(`⏭️ تم تخطي التصويت`)
                .setDescription(
                  `بناءً على تصويت أغلبية اللاعبين، تم تخطي التصويت في هذه الجولة\nلن يتم إقصاء أحد وسننتقل للجولة القادمة`
                )
                .setColor(0x8c52ff);
              await interaction.channel.send({ embeds: [skipEmbed] }).catch(() => null);

              roundNum++;
              setTimeout(runRound, 5000);
              return;
            }

            // Tally votes
            activePlayers.forEach((p) => {
              votedCount[p.id] = 0;
            });
            Object.values(votes).forEach((votedId) => {
              if (votedCount[votedId] !== undefined) votedCount[votedId]++;
            });

            let maxVotes = -1;
            let accusedId = null;
            let tie = false;

            Object.entries(votedCount).forEach(([userId, count]) => {
              if (count > maxVotes) {
                maxVotes = count;
                accusedId = userId;
                tie = false;
              } else if (count === maxVotes) {
                tie = true;
              }
            });

            if (accusedId === null || (maxVotes === 0 && skipVotes.size > 0)) {
              const skipEmbed = new EmbedBuilder()
                .setTitle(`⏭️ تم تخطي التصويت`)
                .setDescription(`لم يتم تسجيل أي تصويت ضد اللاعبين\nلن يتم إقصاء أحد وسننتقل للجولة القادمة`)
                .setColor(0x8c52ff);
              await interaction.channel.send({ embeds: [skipEmbed] }).catch(() => null);

              roundNum++;
              setTimeout(runRound, 5000);
              return;
            }

            if (tie) {
              accusedId = undercoverPlayer.id; // tie-breaker fallback
            }

            if (accusedId === undercoverPlayer.id) {
              // Undercover found!
              const revealEmbed = new EmbedBuilder()
                .setTitle(`🔍 كشفتم برة السالفة`)
                .setDescription(
                  `لقد نجحتم في كشف العضو برة السالفة وهو <@${undercoverPlayer.id}>\n\n⚠️ **الفرصة الأخيرة لـ <@${undercoverPlayer.id}>**\nلديك الآن فرصة لتخمين الشيء السري لكسب نقطة الفوز اختر الكلمة الصحيحة من الأزرار أدناه`
                )
                .setColor(0x00e676);

              const choices = [...randomSubject.options];
              if (!choices.includes(randomSubject.word)) {
                choices.push(randomSubject.word);
              }
              choices.sort(() => Math.random() - 0.5);

              const choiceBtns = choices.slice(0, 4).map((choice, index) => {
                return new ButtonBuilder()
                  .setCustomId(`s_choice_${index}_${choice === randomSubject.word ? 'correct' : 'wrong'}`)
                  .setLabel(choice)
                  .setStyle(ButtonStyle.Secondary);
              });

              const choiceRow = new ActionRowBuilder().addComponents(choiceBtns);
              const guessMsg = await interaction.channel
                .send({ embeds: [revealEmbed], components: [choiceRow] })
                .catch(() => null);
              if (!guessMsg) {
                activeGames.delete(interaction.channelId);
                return;
              }

              const guessCollector = guessMsg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 20000
              });

              guessCollector.on('collect', (i) => {
                if (i.user.id !== undercoverPlayer.id) {
                  return i
                    .reply({ content: '❌ أنت لست الشخص الذي هو برة السالفة للتخمين', flags: ['Ephemeral'] })
                    .catch(() => null);
                }
                const isCorrect = i.customId.endsWith('correct');
                guessCollector.stop(isCorrect ? 'guess_correct' : 'guess_wrong');
              });

              guessCollector.on('end', async (collected, reason) => {
                const disabledChoiceBtns = choiceBtns.map((btn) => ButtonBuilder.from(btn).setDisabled(true));
                const disabledChoiceRow = new ActionRowBuilder().addComponents(disabledChoiceBtns);
                await guessMsg.edit({ components: [disabledChoiceRow] }).catch(() => null);

                activeGames.delete(interaction.channelId);

                if (reason === 'guess_correct') {
                  const winEmbed = new EmbedBuilder()
                    .setTitle(`🎉 فاز برة السالفة`)
                    .setDescription(
                      `مبروك <@${undercoverPlayer.id}> لقد خمنت الكلمة بنجاح وهي **${randomSubject.word}** وفزت باللعبة`
                    )
                    .setColor(0xffff00);
                  await interaction.channel.send({ embeds: [winEmbed] }).catch(() => null);
                } else {
                  const winEmbed = new EmbedBuilder()
                    .setTitle(`🏆 فاز اللاعبون جوة السالفة`)
                    .setDescription(
                      `تخمين خاطئ من برة السالفة الكلمة السرية كانت **${randomSubject.word}**\n\nلقد فاز اللاعبون (جوة السالفة) بالجولة 🎉`
                    )
                    .setColor(0x00e676);
                  await interaction.channel.send({ embeds: [winEmbed] }).catch(() => null);
                }
              });
            } else {
              // Innocent eliminated! Move to next round
              activePlayers = activePlayers.filter((ap) => ap.id !== accusedId);

              const eliminatedEmbed = new EmbedBuilder()
                .setTitle(`❌ تصويت خاطئ`)
                .setDescription(
                  `لقد صوّتم للعضو الخطأ وهو <@${accusedId}>\n\nهذا اللاعب كان **جوة السالفة** وتم استبعاده من اللعب\nسنتقدم للجولة القادمة الآن`
                )
                .setColor(0xef4444);
              await interaction.channel.send({ embeds: [eliminatedEmbed] }).catch(() => null);

              roundNum++;
              setTimeout(runRound, 5000);
            }
          });
        }

        // Start the first round loop!
        await runRound();
      });
    } catch (err) {
      logger.error('[Command Error - salfa.js]:', err);
      activeGames.delete(interaction.channelId);
      if (interaction && typeof interaction.editReply === 'function') {
        await interaction.editReply({ content: '❌ حدث خطأ أثناء بدء اللعبة', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
  }
};
