const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const activeGames = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chairs')
    .setDescription('لعبة الكراسي الموسيقية'),

  async execute(interaction) {
    if (activeGames.has(interaction.channelId)) {
      return interaction.reply({ content: 'هناك لعبة جارية في هذا الروم حالياً', ephemeral: true });
    }

    activeGames.add(interaction.channelId);

    let emojis = {};
    try {
      emojis = JSON.parse(fs.readFileSync(path.join(__dirname, '../../utils/emojis.json'), 'utf8'));
    } catch (e) {
      console.error('[chairs] Failed to load emojis.json:', e.message);
    }

    const starEmoji = emojis.star || '⭐';
    const clockEmoji = emojis.clock || '⏱️';
    const circlexEmoji = emojis.circlex || '❌';
    const trophyEmoji = emojis.trophy || '🏆';

    let players = [];

    const embed = new EmbedBuilder()
      .setTitle(`${starEmoji} لعبة الكراسي`)
      .setDescription(`**كيفية اللعب**\nاضغط على زر دخول للمشاركة\nفي كل جولة ستظهر أزرار الكراسي الخضراء ويجب عليك الضغط عليها بسرعة لحجز مكانك\nتأكد من عدم الوقوع في جولة الفخ (الأزرار الحمراء)\n\n${clockEmoji} **لديك 30 ثانية للانضمام**`)
      .setColor(0x8C52FF)
      .addFields({ name: 'اللاعبون (0)', value: 'لا يوجد أحد بعد' });

    const joinBtn = new ButtonBuilder().setCustomId('c_join').setLabel('دخول للعبة').setStyle(ButtonStyle.Success);
    const leaveBtn = new ButtonBuilder().setCustomId('c_leave').setLabel('خروج من اللعبة').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
      if (i.customId === 'c_join') {
        if (players.length >= 20) {
          return i.reply({ content: 'عذراً، اكتمل العدد الأقصى للعبة (20 لاعب)', ephemeral: true }).catch(() => {});
        }
        if (!players.some(p => p.id === i.user.id)) {
          players.push({ id: i.user.id, name: i.user.username });
        }
      } else if (i.customId === 'c_leave') {
        players = players.filter(p => p.id !== i.user.id);
      }
      
      const playersText = players.length > 0 ? players.slice(0, 40).map(p => `<@${p.id}>`).join('\n') + (players.length > 40 ? `\n...و ${players.length - 40} آخرين` : '') : 'لا يوجد أحد بعد';
      const newEmbed = EmbedBuilder.from(embed).setFields({ name: `اللاعبون (${players.length})`, value: playersText });
      
      await i.update({ embeds: [newEmbed] }).catch(() => {});
    });

    collector.on('end', async () => {
      if (players.length < 2) {
        activeGames.delete(interaction.channelId);
        return interaction.channel.send(`تم إلغاء اللعبة لعدم اكتمال العدد`).catch(() => {});
      }

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(joinBtn).setDisabled(true),
        ButtonBuilder.from(leaveBtn).setDisabled(true)
      );
      await msg.edit({ components: [disabledRow] }).catch(() => {});

      await interaction.channel.send(`تم توزيع الادوار على اللاعبين ستبدأ الجولة الأولى بعد قليل`).catch(() => {});

      setTimeout(() => playRound(interaction.channel), 3000);
    });

    async function playRound(channel) {
      if (players.length === 1) {
        activeGames.delete(channel.id);
        const winEmbed = new EmbedBuilder()
          .setTitle(`${trophyEmoji} الفائز بلعبة الكراسي`)
          .setDescription(`مبروك <@${players[0].id}> لقد نجوت وفزت باللعبة ${trophyEmoji}`)
          .setColor(0xFFFF00);
        return channel.send({ embeds: [winEmbed] }).catch(() => {});
      }

      if (players.length === 0) {
        activeGames.delete(channel.id);
        return channel.send(`لم يتبق أحد في اللعبة`).catch(() => {});
      }

      
      const chairCount = Math.max(1, players.length - (players.length > 5 ? 2 : 1));
      
      const isTrap = Math.random() < 0.25;
      
      const buttons = [];
      for (let i = 1; i <= chairCount; i++) {
        const emojiStr = emojis[`num_${i}`] || '🪑';
        
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`chair_${i}`)
            .setStyle(isTrap ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(emojiStr)
        );
      }

      
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }

      const actionMsg = await channel.send({
        content: `إضغط على الزر (0/${chairCount})`,
        components: rows
      }).catch(() => null);

      if (!actionMsg) return;

      const roundCollector = actionMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });

      const clickedPlayers = new Set();
      const successfulPlayers = [];
      const trappedPlayers = [];
      let chairsTaken = 0;

      roundCollector.on('collect', async i => {
        if (!players.some(p => p.id === i.user.id)) {
          return i.reply({ content: 'لست مشاركاً في هذه اللعبة', ephemeral: true }).catch(() => {});
        }

        if (clickedPlayers.has(i.user.id)) {
          return i.reply({ content: 'لقد ضغطت بالفعل', ephemeral: true }).catch(() => {});
        }

        const chairNum = i.customId.split('_')[1];
        clickedPlayers.add(i.user.id);

        if (isTrap) {
          trappedPlayers.push(i.user.id);
        } else {
          successfulPlayers.push(i.user.id);
        }

        
        i.reply({ content: `لقد قمت بحجز الكرسي رقم ${chairNum}`, ephemeral: true }).catch(() => {});

        chairsTaken++;

        
        for (const row of rows) {
          for (const component of row.components) {
            if (component.data.custom_id === i.customId) {
              component.setDisabled(true);
              component.setStyle(ButtonStyle.Secondary);
            }
          }
        }

        await actionMsg.edit({
          content: `إضغط على الزر (${chairsTaken}/${chairCount})`,
          components: rows
        }).catch(() => {});

        if (!isTrap && chairsTaken >= chairCount) {
          roundCollector.stop('chairs_full');
        }
      });

      roundCollector.on('end', async () => {
        let eliminatedIds = [];

        if (isTrap) {
          eliminatedIds = trappedPlayers;
        } else {
          eliminatedIds = players.map(p => p.id).filter(id => !successfulPlayers.includes(id));
        }

        
        for (const row of rows) {
          for (const component of row.components) {
            component.setDisabled(true);
          }
        }
        await actionMsg.edit({ content: `انتهت الجولة`, components: rows }).catch(() => {});

        if (eliminatedIds.length > 0) {
          const elimText = eliminatedIds.map(id => `<@${id}>`).join(' و ');
          await channel.send(`لقد تم طرد ${elimText}`).catch(() => {});
          
          
          players = players.filter(p => !eliminatedIds.includes(p.id));
        } else {
          await channel.send(`لم يتم طرد أحد في هذه الجولة`).catch(() => {});
        }

        setTimeout(() => playRound(channel), 3000);
      });
    }
  }
};
