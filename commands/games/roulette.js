const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { generateRouletteGif } = require('../../utils/rouletteHelper');
const emojis = require('../../utils/emojis.json');


const activeGames = new Set();

const WHEEL_COLORS = [
    '#FF3366', '#33CCFF', '#33FF99', '#FF9933', '#9933FF', 
    '#FFCC33', '#FF3333', '#33FFFC', '#B5FF33', '#E033FF'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('بدء لعبة الروليت'),
        
    async execute(interaction) {
        if (activeGames.has(interaction.channelId)) {
            return interaction.reply({ content: `${emojis.circlex} هناك لعبة روليت شغالة في هذا الروم حالياً`, flags: 64 });
        }

        activeGames.add(interaction.channelId);

        let players = [];

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.star} عجلة الروليت`)
            .setDescription(`**كيفية اللعب**\nاضغط على زر دخول للمشاركة في اللعبة\nعندما ينتهي الوقت ستدور العجلة ويقع السهم على أحد اللاعبين\nاللاعب المختار يجب أن يطرد شخصاً آخر أو ينسحب بنفسه\nالبقاء للأخير هو الفائز\n\n${emojis.clock} **لديك 30 ثانية للانضمام**`)
            .setColor(0x5865F2)
            .addFields({ name: 'اللاعبون (0)', value: 'لا يوجد أحد بعد' });

        const joinBtn = new ButtonBuilder().setCustomId('r_join').setLabel('دخول للعبة').setStyle(ButtonStyle.Secondary);
        const leaveBtn = new ButtonBuilder().setCustomId('r_leave').setLabel('خروج من اللعبة').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

        await interaction.reply({ embeds: [embed], components: [row] });
        const message = await interaction.fetchReply();
        
        if (!message) {
            activeGames.delete(interaction.channelId);
            return;
        }

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'r_join') {
                if (!players.some(p => p.id === i.user.id)) {
                    const color = WHEEL_COLORS[players.length % WHEEL_COLORS.length];
                    players.push({ id: i.user.id, name: i.user.username, color });
                }
            } else if (i.customId === 'r_leave') {
                players = players.filter(p => p.id !== i.user.id);
            }
            
            const playersText = players.length > 0 ? players.slice(0, 40).map(p => `<@${p.id}>`).join('\n') + (players.length > 40 ? `\n...و ${players.length - 40} آخرين` : '') : 'لا يوجد أحد بعد';
            const newEmbed = EmbedBuilder.from(embed).setFields({ name: `اللاعبون (${players.length})`, value: playersText });
            await i.update({ embeds: [newEmbed] }).catch(() => {});
        });

        collector.on('end', async () => {
            if (players.length < 2) {
                activeGames.delete(interaction.channelId);
                return interaction.channel.send(`${emojis.circlex} تم إلغاء اللعبة لعدم اكتمال العدد يجب أن يكون هناك لاعبان على الأقل`);
            }

            
            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(joinBtn).setDisabled(true),
                ButtonBuilder.from(leaveBtn).setDisabled(true)
            );
            await message.edit({ components: [disabledRow] });

            await interaction.channel.send(`${emojis.confetti} بدأنا اللعبة بـ ${players.length} لاعبين جاري تدوير العجلة ${emojis.clock}`);

            
            await playRound(interaction.channel);
        });

        async function playRound(channel) {
            if (players.length === 1) {
                activeGames.delete(channel.id);
                const winEmbed = new EmbedBuilder()
                    .setTitle(`${emojis.trophy} الفائز بالروليت`)
                    .setDescription(`ألف مبروك <@${players[0].id}> لقد نجوت وفزت باللعبة ${emojis.confetti}`)
                    .setColor(0xFFFF00);
                return channel.send({ embeds: [winEmbed] });
            }

            
            const winnerIndex = Math.floor(Math.random() * players.length);
            const winner = players[winnerIndex];

            let gifBuffer;
            try {
                gifBuffer = await generateRouletteGif(players, winnerIndex);
            } catch (e) {
                console.error('[Roulette] Error generating GIF:', e.message);
                return await channel.send({ content: `❌ خطأ في اللعبة: ${e.message}` });
            }
            
            const attachment = new AttachmentBuilder(gifBuffer, { name: 'roulette.png' });
            await channel.send({ files: [attachment] });

            
            await new Promise(res => setTimeout(res, 2000));

            const actionEmbed = new EmbedBuilder()
                .setTitle(`${emojis.crown} السهم وقف على ${winner.name}`)
                .setDescription(`يا <@${winner.id}> اختار شخص تطرده برا اللعبة من القائمة أو تقدر تنسحب بنفسك وتعطي فرصة للباقين لديك 30 ثانية للاختيار`)
                .setColor(0xFF0000);

            
            const options = players.filter(p => p.id !== winner.id).map(p => ({
                label: p.name,
                value: p.id,
                emoji: emojis.trash
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('r_kick')
                .setPlaceholder('اختر شخصاً لطرده')
                .addOptions(options);

            const withdrawBtn = new ButtonBuilder()
                .setCustomId('r_withdraw')
                .setLabel('انسحاب (تضحية)')
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.flag);

            const menuRow = new ActionRowBuilder().addComponents(selectMenu);
            const btnRow = new ActionRowBuilder().addComponents(withdrawBtn);

            const actionMsg = await channel.send({ content: `<@${winner.id}>`, embeds: [actionEmbed], components: [menuRow, btnRow] });

            const filter = i => true;
            const roundCollector = actionMsg.createMessageComponentCollector({ filter, time: 30000 });

            roundCollector.on('collect', async i => {
                if (i.user.id !== winner.id) {
                    return i.reply({ content: '**هذا الزر لا يخصك**', flags: 64 });
                }

                if (i.isStringSelectMenu() && i.customId === 'r_kick') {
                    const kickedId = i.values[0];
                    players = players.filter(p => p.id !== kickedId);
                    await i.update({ content: `${emojis.circlex} تم طرد <@${kickedId}> من اللعبة`, embeds: [], components: [] });
                    roundCollector.stop('acted');
                } else if (i.isButton() && i.customId === 'r_withdraw') {
                    players = players.filter(p => p.id !== winner.id);
                    await i.update({ content: `${emojis.flag} لقد انسحب <@${winner.id}>`, embeds: [], components: [] });
                    roundCollector.stop('acted');
                }
            });

            roundCollector.on('end', async (collected, reason) => {
                if (reason !== 'acted') {
                    
                    await actionMsg.edit({ content: `${emojis.alerttriangle} انتهى الوقت <@${winner.id}> لم يتخذ قراراً وتم استبعاده عشوائياً`, embeds: [], components: [] });
                    players = players.filter(p => p.id !== winner.id);
                }

                
                setTimeout(() => playRound(channel), 2000);
            });
        }
    },
};
