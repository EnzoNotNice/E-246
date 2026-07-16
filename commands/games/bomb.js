const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const activeGames = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bomb')
    .setDescription('لعبة القنبلة'),

  async execute(interaction) {
    if (activeGames.has(interaction.channelId)) {
      return interaction.reply({ content: 'هناك لعبة جارية في هذا الروم حالياً', ephemeral: true });
    }

    activeGames.add(interaction.channelId);

    let players = [];
    let playerHearts = {};
    let currentPlayerIndex = 0;
    let gameActive = true;

    const quizPath = path.join(__dirname, '../../assets/games/bomb_quiz.json');
    let quiz = [];
    try {
      quiz = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
    } catch (e) {
      quiz = [
        { "partial": "قط", "complete": "قطة" },
        { "partial": "كل", "complete": "كلب" },
        { "partial": "سيار", "complete": "سيارة" }
      ];
    }

    const embed = new EmbedBuilder()
      .setTitle('{emoji:star} لعبة القنبلة')
      .setDescription(`**كيفية اللعب**\nاضغط على زر دخول للمشاركة\nفي كل جولة سيتم طرح كلمة ناقصة ويجب عليك إكمالها خلال 15 ثانية وإلا ستفقد قلباً\nيملك كل لاعب قلبين فقط للتأهل\n\n{emoji:clock} **لديك 30 ثانية للانضمام**`)
      .setColor(0x8C52FF)
      .addFields({ name: 'اللاعبون (0)', value: 'لا يوجد أحد بعد' });

    const joinBtn = new ButtonBuilder().setCustomId('b_join').setLabel('دخول للعبة').setStyle(ButtonStyle.Success);
    const leaveBtn = new ButtonBuilder().setCustomId('b_leave').setLabel('خروج من اللعبة').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
      if (i.customId === 'b_join') {
        if (players.length >= 15) {
          return i.reply({ content: 'عذراً، اكتمل العدد الأقصى للعبة (15 لاعب)', ephemeral: true }).catch(() => {});
        }
        if (!players.includes(i.user.id)) {
          players.push(i.user.id);
          playerHearts[i.user.id] = 2;
        }
      } else if (i.customId === 'b_leave') {
        players = players.filter(id => id !== i.user.id);
        delete playerHearts[i.user.id];
      }
      
      const playersText = players.length > 0 ? players.map(id => `<@${id}>`).join('\n') : 'لا يوجد أحد بعد';
      const newEmbed = EmbedBuilder.from(embed).setFields({ name: `اللاعبون (${players.length})`, value: playersText });
      
      await i.update({ embeds: [newEmbed] }).catch(() => {});
    });

    collector.on('end', async () => {
      if (players.length < 3) {
        activeGames.delete(interaction.channelId);
        gameActive = false;
        return interaction.channel.send(`تم إلغاء اللعبة لعدم اكتمال العدد (مطلوب 3 لاعبين على الأقل)`).catch(() => {});
      }

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(joinBtn).setDisabled(true),
        ButtonBuilder.from(leaveBtn).setDisabled(true)
      );
      await msg.edit({ components: [disabledRow] }).catch(() => {});

      await interaction.channel.send(`تبدأ اللعبة قريباً، ستبدأ الجولة الأولى في غضون 5 ثوانٍ...`).catch(() => {});

      setTimeout(() => playRound(), 5000);
    });

    async function playRound() {
      if (!gameActive) return;
      if (players.length === 1) {
        activeGames.delete(interaction.channelId);
        gameActive = false;
        const winner = players[0];
        const winnerUser = await interaction.client.users.fetch(winner).catch(() => null);
        const winnerEmbed = new EmbedBuilder()
          .setTitle(`🎉 لدينا فائز في لعبة القنبلة 🎉`)
          .setDescription(`مبروك <@${winner}> لقد نجوت وفزت باللعبة\n\nعدد القلوب المتبقية: **${playerHearts[winner]}**`)
          .setColor(0xFFD700);

        if (winnerUser) {
          winnerEmbed.setThumbnail(winnerUser.displayAvatarURL({ dynamic: true }));
        }

        return interaction.channel.send({ embeds: [winnerEmbed] }).catch(() => {});
      }

      currentPlayerIndex = Math.floor(Math.random() * players.length);
      const player = players[currentPlayerIndex];
      const question = quiz[Math.floor(Math.random() * quiz.length)];
      const user = await interaction.client.users.fetch(player).catch(() => null);

      if (!user) {
        players = players.filter(id => id !== player);
        delete playerHearts[player];
        return playRound();
      }

      const imageBuffer = await generateImage(question.partial, user);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'bomb.png' });

      await interaction.channel.send({
        content: `الدور على: <@${player}>\nاكمل الكلمة الموضحة في الصورة بالأسفل خلال 15 ثانية\nالقلوب المتبقية لك: **${playerHearts[player]}**`,
        files: [attachment]
      });

      let answered = false;
      const filter = m => m.author.id === player && m.content.trim().toLowerCase() === question.complete.toLowerCase();
      const wordCollector = interaction.channel.createMessageCollector({ filter, time: 15000 });

      wordCollector.on('collect', async m => {
        if (!answered) {
          answered = true;
          await m.reply('إجابة صحيحة، تم تفادي القنبلة والانتقال للجولة التالية.').catch(() => {});
          wordCollector.stop('answered');
        }
      });

      wordCollector.on('end', async (collected, reason) => {
        if (reason !== 'answered') {
          playerHearts[player]--;
          if (playerHearts[player] <= 0) {
            await interaction.channel.send(`خسر <@${player}> كل قلوبه وتم إقصاؤه من اللعبة، الكلمة الكاملة كانت: **${question.complete}**`).catch(() => {});
            players = players.filter(id => id !== player);
            delete playerHearts[player];
          } else {
            await interaction.channel.send(`انتهى الوقت، خسر <@${player}> قلباً. القلوب المتبقية له: **${playerHearts[player]}**\nالكلمة الكاملة كانت: **${question.complete}**`).catch(() => {});
          }
        }
        setTimeout(() => {
          playRound();
        }, 3000);
      });
    }

    async function generateImage(partialText, user) {
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
        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
        const res = await fetch(avatarUrl);
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
      } catch (err) {}

      ctx.font = 'bold 24px "IBMPlexSansArabic", "CustomFont", sans-serif';
      ctx.fillStyle = '#FF5252';
      ctx.textAlign = 'right';
      const displayName = user.username.length > 18 ? user.username.slice(0, 15) + '..' : user.username;
      ctx.fillText(`دور اللاعب: ${displayName}`, 740, 80);

      ctx.font = 'bold 54px "IBMPlexSansArabic", "CustomFont", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(`${partialText}..`, 480, 170);

      ctx.font = '20px "IBMPlexSansArabic", "CustomFont", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('أكمل الكلمة الموضحة أعلاه قبل انفجار القنبلة', 480, 230);

      return canvas.toBuffer();
    }
  }
};
