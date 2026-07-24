const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const activeGames = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faster')
    .setDescription('لعبة أسرع كتابة'),

  async execute(interaction) {
    if (!interaction.guild || !interaction.channel) {
      return interaction.reply({ content: 'يمكنك استخدام هذا الأمر داخل السيرفرات فقط', ephemeral: true });
    }

    if (activeGames.has(interaction.channelId)) {
      return interaction.reply({ content: 'هناك لعبة جارية في هذا الروم حالياً', ephemeral: true });
    }

    activeGames.add(interaction.channelId);

    let players = [];
    let playerPoints = {};
    let currentRound = 1;
    const totalRounds = 15;
    let gameActive = true;

    const quizPath = path.join(__dirname, '../../assets/games/faster_quiz.json');
    let quiz = [];
    try {
      quiz = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
    } catch (e) {
      quiz = ["تفاحة", "موز", "برتقال", "بطيخ", "فراولة", "ليمون", "عنب", "مشمش", "خوخ", "كيوي"];
    }

    const embed = new EmbedBuilder()
      .setTitle('{emoji:star} لعبة أسرع كتابة')
      .setDescription(`**كيفية اللعب**\nاضغط على زر دخول للمشاركة\nستظهر صورة تحتوي على كلمة ويجب عليك كتابتها بأسرع ما يمكن للحصول على نقطة\n\n{emoji:clock} **لديك 30 ثانية للانضمام**`)
      .setColor(0x8C52FF)
      .addFields({ name: 'اللاعبون (0)', value: 'لا يوجد أحد بعد' });

    const joinBtn = new ButtonBuilder().setCustomId('f_join').setLabel('دخول للعبة').setStyle(ButtonStyle.Success);
    const leaveBtn = new ButtonBuilder().setCustomId('f_leave').setLabel('خروج من اللعبة').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
      if (i.customId === 'f_join') {
        if (players.length >= 20) {
          return i.reply({ content: 'عذراً، اكتمل العدد الأقصى للعبة (20 لاعب)', ephemeral: true }).catch(() => {});
        }
        if (!players.includes(i.user.id)) {
          players.push(i.user.id);
          playerPoints[i.user.id] = 0;
        }
      } else if (i.customId === 'f_leave') {
        players = players.filter(id => id !== i.user.id);
        delete playerPoints[i.user.id];
      }
      
      const playersText = players.length > 0 ? players.map(id => `<@${id}>`).join('\n') : 'لا يوجد أحد بعد';
      const newEmbed = EmbedBuilder.from(embed).setFields({ name: `اللاعبون (${players.length})`, value: playersText });
      
      await i.update({ embeds: [newEmbed] }).catch(() => {});
    });

    collector.on('end', async () => {
      if (players.length < 2) {
        activeGames.delete(interaction.channelId);
        gameActive = false;
        return interaction.channel?.send(`تم إلغاء اللعبة لعدم اكتمال العدد (مطلوب لاعبين على الأقل)`).catch(() => {});
      }

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(joinBtn).setDisabled(true),
        ButtonBuilder.from(leaveBtn).setDisabled(true)
      );
      await msg.edit({ components: [disabledRow] }).catch(() => {});

      await interaction.channel?.send(`تبدأ اللعبة قريباً، ستبدأ الجولة الأولى في غضون 5 ثوانٍ...`).catch(() => {});

      setTimeout(() => playRound(), 5000);
    });

    async function playRound() {
      if (!gameActive) return;
      if (currentRound > totalRounds) {
        return announceWinners();
      }

      const word = quiz[Math.floor(Math.random() * quiz.length)];
      const imageBuffer = await generateImage(word);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'faster.png' });

      await interaction.channel?.send({
        content: `**الجولة ${currentRound}/${totalRounds}**\nاكتب الكلمة الموضحة في الصورة بأسرع ما يمكن`,
        files: [attachment]
      });

      let answered = false;
      const filter = m => players.includes(m.author.id) && m.content.trim().toLowerCase() === word.toLowerCase();
      const wordCollector = interaction.channel?.createMessageCollector({ filter, time: 15000 });

      if (wordCollector) {
        wordCollector.on('collect', async m => {
          if (!answered) {
            answered = true;
            playerPoints[m.author.id]++;
            await m.reply(`إجابة صحيحة، حصل <@${m.author.id}> على نقطة.`).catch(() => {});
            wordCollector.stop('answered');
          }
        });

        wordCollector.on('end', (collected, reason) => {
          if (reason !== 'answered') {
            interaction.channel?.send(`انتهى وقت الجولة، الكلمة الصحيحة هي: **${word}**`).catch(() => {});
          }
          setTimeout(() => {
            currentRound++;
            playRound();
          }, 3000);
        });
      }
    }

    async function announceWinners() {
      activeGames.delete(interaction.channelId);
      gameActive = false;
      const sorted = Object.entries(playerPoints).sort((a, b) => b[1] - a[1]);
      const top3 = sorted.slice(0, 3);
      const rest = sorted.slice(3);

      const winEmbed = new EmbedBuilder()
        .setTitle('{emoji:trophy} نتائج لعبة أسرع كتابة')
        .setColor(0xFFFF00)
        .addFields(
          { name: '🥇 المركز الأول', value: top3[0] ? `<@${top3[0][0]}> - ${top3[0][1]} نقطة` : 'لا يوجد', inline: true },
          { name: '🥈 المركز الثاني', value: top3[1] ? `<@${top3[1][0]}> - ${top3[1][1]} نقطة` : 'لا يوجد', inline: true },
          { name: '🥉 المركز الثالث', value: top3[2] ? `<@${top3[2][0]}> - ${top3[2][1]} نقطة` : 'لا يوجد', inline: true }
        );

      if (rest.length > 0) {
        winEmbed.addFields({
          name: 'باقي المشاركين',
          value: rest.map(([id, points]) => `<@${id}> - ${points} نقطة`).join('\n')
        });
      }

      await interaction.channel?.send({ embeds: [winEmbed] }).catch(() => {});
    }

    async function generateImage(word) {
      const canvas = createCanvas(800, 300);
      const ctx = canvas.getContext('2d');

      function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 10;
      roundRect(ctx, 20, 20, 760, 260, 25);
      ctx.fillStyle = 'rgba(15, 15, 20, 0.75)';
      ctx.fill();
      ctx.restore();

      roundRect(ctx, 20, 20, 760, 260, 25);
      ctx.lineWidth = 2;
      const borderGrad = ctx.createLinearGradient(20, 20, 780, 280);
      borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
      ctx.strokeStyle = borderGrad;
      ctx.stroke();

      try {
        const iconUrl = interaction.guild?.iconURL({ extension: 'png', size: 256 }) || interaction.client.user?.displayAvatarURL({ extension: 'png', size: 256 });
        if (iconUrl) {
          const res = await fetch(iconUrl);
          const arrayBuffer = await res.arrayBuffer();
          const avatar = await loadImage(Buffer.from(arrayBuffer));
          
          if (avatar) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(140, 150, 80, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 60, 70, 160, 160);
            ctx.restore();

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(140, 150, 80, 0, Math.PI * 2, true);
            ctx.stroke();
          }
        }
      } catch (err) {}

      ctx.font = 'bold 24px "IBMPlexSansArabic", "CustomFont", sans-serif';
      ctx.fillStyle = '#8C52FF';
      ctx.textAlign = 'right';
      const rawGuildName = interaction.guild?.name || 'Server';
      const guildName = rawGuildName.length > 18 ? rawGuildName.slice(0, 15) + '..' : rawGuildName;
      ctx.fillText(guildName, 740, 80);

      ctx.font = 'bold 54px "IBMPlexSansArabic", "CustomFont", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(word, 480, 170);

      ctx.font = '20px "IBMPlexSansArabic", "CustomFont", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('اكتب الكلمة الموضحة أعلاه بأسرع ما يمكن', 480, 230);

    return canvas.toBuffer();
    }
  }
};
