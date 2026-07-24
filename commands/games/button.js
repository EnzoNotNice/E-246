const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('button')
    .setDescription('لعبة زر السرعة'),

  async execute(interaction) {
    
    let emojis = {};
    try {
      emojis = JSON.parse(fs.readFileSync(path.join(__dirname, '../../utils/emojis.json'), 'utf8'));
    } catch (e) {
      console.error('[button] Failed to load emojis.json:', e.message);
    }

    const clockEmoji = emojis.clock || '⏱️';
    const checkEmoji = emojis.circlecheck || '🟢';
    const xEmoji = emojis.circlex || '❌';
    const trophyEmoji = emojis.trophy || '🏆';

    
    const createInitialRows = () => {
      const rows = [];
      for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let b = 0; b < 5; b++) {
          const id = r * 5 + b;
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`btn_${id}`)
              .setStyle(ButtonStyle.Secondary)
              .setLabel('\u200b')
              .setDisabled(true)
          );
        }
        rows.push(row);
      }
      return rows;
    };

    const msg = await interaction.reply({
      content: `${clockEmoji} استعد ستبدأ اللعبة بعد 5 ثوان`,
      components: createInitialRows(),
      fetchReply: true
    });

    let gameEnded = false;

    
    setTimeout(async () => {
      if (gameEnded) return;

      const greenIndex = Math.floor(Math.random() * 20);
      
      
      const activeRows = [];
      for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let b = 0; b < 5; b++) {
          const id = r * 5 + b;
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`btn_${id}`)
              .setStyle(id === greenIndex ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setLabel('\u200b')
              .setDisabled(false)
          );
        }
        activeRows.push(row);
      }

      await interaction.editReply({
        content: `${checkEmoji} اضغط على الزر الأخضر بسرعة`,
        components: activeRows
      }).catch(() => {});

      
      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 15000
      });

      collector.on('collect', async (i) => {
        const clickedIndex = parseInt(i.customId.split('_')[1]);

        if (clickedIndex !== greenIndex) {
          return i.reply({
            content: `${xEmoji} هذا ليس الزر الأخضر ركز واضغط على الأخضر`,
            ephemeral: true
          }).catch(() => {});
        }

        
        gameEnded = true;
        collector.stop('winner');

        
        const endRows = [];
        for (let r = 0; r < 4; r++) {
          const row = new ActionRowBuilder();
          for (let b = 0; b < 5; b++) {
            const id = r * 5 + b;
            const btn = new ButtonBuilder()
              .setCustomId(`btn_end_${id}`)
              .setStyle(id === greenIndex ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setDisabled(true);

            if (id === greenIndex) {
              btn.setEmoji(trophyEmoji);
            } else {
              btn.setLabel('\u200b');
            }
            row.addComponents(btn);
          }
          endRows.push(row);
        }

        await i.update({
          content: `${trophyEmoji} مبروك <@${i.user.id}> لقد فزت باللعبة`,
          components: endRows
        }).catch(() => {});
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'winner') return;

        
        const timeoutRows = [];
        for (let r = 0; r < 4; r++) {
          const row = new ActionRowBuilder();
          for (let b = 0; b < 5; b++) {
            const id = r * 5 + b;
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`btn_time_${id}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel('\u200b')
                .setDisabled(true)
            );
          }
          timeoutRows.push(row);
        }

        await interaction.editReply({
          content: `${clockEmoji} انتهى الوقت لم يضغط أحد على الزر الأخضر`,
          components: timeoutRows
        }).catch(() => {});
      });

    }, 5000);
  }
};
