const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { getUserBoostInfo } = require('../../utils/selfbotHelper');
const { formatExactTime, getDaysSince, getMsSince } = require('../../utils/timeFormatters');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boost')
        .setDescription('معلومات البوست لعضو')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('العضو لمعلومات البوست')),
    async getBoostPayload(target, userToken) {
        try {
            const boostRes = await getUserBoostInfo(userToken, target.id);
            
            if (!boostRes.success) {
                return {
                    content: `❌ فشل في جلب بيانات البوست للعضو. السبب: ${boostRes.error}`,
                    components: [],
                    files: []
                };
            }

            const boostData = boostRes.data;
            
            if (!boostData.hasBoost && boostData.boostMonths === 0) {
                return {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xED4245)
                            .setDescription(`**${target.username}** ليس لديه أي بوستات نشطة في هذا السيرفر`)
                    ]
                };
            }

            const nextTierNum = (boostData.badgeTier > 0 && boostData.badgeTier < 9) ? boostData.badgeTier + 1 : null;
            const msSince = getMsSince(boostData.oldestBoostDate);
            const emojis = require('../../utils/emojis.json');
            const profileTimestamp = Math.floor(new Date(boostData.oldestBoostDate).getTime() / 1000);

            const embed = new EmbedBuilder()
                .setTitle(`${emojis.boost_progression || '💖'} ${target.displayName} Boost Progression`)
                .setColor(0xff73fa)
                .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 512 }))
                .setDescription(
                    `<@${target.id}> \`(${target.username})\`\n\n` +
                    `**Boost Type:** Server Boost\n` +
                    `${emojis.icon_time || '📅'} **Boosting Since:** <t:${profileTimestamp}:R> - ${formatExactTime(msSince)}`
                );

            const currentEmojiStr = emojis[`boost_${boostData.badgeTier}`] || '';
            const earnedMsSince = getMsSince(boostData.currentBadgeEarnedDate);
            const currentEarnedTimestamp = Math.floor(new Date(boostData.currentBadgeEarnedDate).getTime() / 1000);

            embed.addFields({
                name: 'Current Level',
                value: `${currentEmojiStr} **Level ${boostData.badgeTier}** ${currentEmojiStr} (${boostData.boostMonths} Month${boostData.boostMonths !== 1 ? 's' : ''})\n` +
                       `${emojis.icon_earned || '⭐'} Earned: <t:${currentEarnedTimestamp}:R> - ${formatExactTime(earnedMsSince)} ago`
            });

            if (nextTierNum) {
                const nextEmojiStr = emojis[`boost_${nextTierNum}`] || '';
                const nextMonths = [0, 1, 2, 3, 6, 9, 12, 15, 18, 24][nextTierNum] || 24;
                
                let timeRemContent = 'Soon';
                if (boostData.timeRemainingMs != null) {
                    const nextEarnedTimestamp = Math.floor((Date.now() + boostData.timeRemainingMs) / 1000);
                    timeRemContent = `<t:${nextEarnedTimestamp}:R> - In ${formatExactTime(boostData.timeRemainingMs)}`;
                }

                embed.addFields({
                    name: 'Next Level',
                    value: `${nextEmojiStr} **Level ${nextTierNum}** ${nextEmojiStr} (${nextMonths} Month${nextMonths !== 1 ? 's' : ''})\n` +
                           `${emojis.icon_time || '📅'} Time Remaining: ${timeRemContent}`
                });
            }

            const { generateBoostCard } = require('../../utils/canvasHelper');
            const buffer = await generateBoostCard(boostData, target.displayAvatarURL({ extension: 'png', size: 512 }));
            
            const files = [new AttachmentBuilder(buffer, { name: 'boost_canvas.png' })];
            embed.setImage('attachment://boost_canvas.png');

            return {
                embeds: [embed],
                files: files
            };
        } catch (e) {
            console.error("Failed to fetch selfbot boost stats or generate components", e);
            throw e;
        }
    },
    async execute(interaction) {
        await interaction.deferReply();
        const target = interaction.options.getUser('target') || interaction.user;
        await target.fetch();
        
        const userToken = process.env.USER_TOKEN;
        if (!userToken) return interaction.editReply({ content: "حط توكن `USER_TOKEN` في ملف `.env`" });
        try {
            const payload = await module.exports.getBoostPayload(target, userToken);
            await interaction.editReply(payload);
        } catch (e) {
            await interaction.editReply({ content: "An error occurred while fetching boost stats." });
        }
    },
};
