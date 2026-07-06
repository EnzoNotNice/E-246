const { SlashCommandBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, AttachmentBuilder, MediaGalleryBuilder } = require('discord.js');
const { getUserBoostInfo } = require('../../utils/selfbotHelper');
const { generateBoostCard } = require('../../utils/canvasHelper');
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
                const noBoostText = new TextDisplayBuilder().setContent(`**${target.username}** ليس لديه أي بوستات نشطة في هذا السيرفر`);
                return {
                    components: [noBoostText],
                    flags: MessageFlags.IsComponentsV2
                };
            }

            const nextTierNum = (boostData.badgeTier > 0 && boostData.badgeTier < 9) ? boostData.badgeTier + 1 : null;

            const msSince = getMsSince(boostData.oldestBoostDate);
            const daysSince = getDaysSince(boostData.oldestBoostDate);

            const emojis = require('../../utils/emojis.json');
            const profileTimestamp = Math.floor(new Date(boostData.oldestBoostDate).getTime() / 1000);

            const profileSection = new SectionBuilder()
                .addTextDisplayComponents(
                    td => td.setContent(`**${emojis.boost_progression} ${target.displayName} Boost Progression**\n<@${target.id}> \`(${target.username})\``),
                    td => td.setContent(`Boost Type: Server Boost`),
                    td => td.setContent(`-# ${emojis.icon_time} Boosting Since: <t:${profileTimestamp}:R> - ${formatExactTime(msSince)}`)
                )
                .setThumbnailAccessory(thumb => thumb.setURL(target.displayAvatarURL({ extension: 'png', size: 512 })));

            const currentEmojiStr = emojis[`boost_${boostData.badgeTier}`] || '';
            const earnedMsSince = getMsSince(boostData.currentBadgeEarnedDate);
            const currentEarnedTimestamp = Math.floor(new Date(boostData.currentBadgeEarnedDate).getTime() / 1000);

            const currentBadgeUrl = boostData.badgeTier > 0 ? `attachment://discordboost${boostData.badgeTier}.png` : '';

            const currentLevelSection = new SectionBuilder()
                .addTextDisplayComponents(
                    td => td.setContent(`${currentEmojiStr} **Level ${boostData.badgeTier}** ${currentEmojiStr} (${boostData.boostMonths} Month${boostData.boostMonths !== 1 ? 's' : ''})`),
                    td => td.setContent(`-# (Current Level)`),
                    td => td.setContent(`-# ${emojis.icon_earned} Earned: <t:${currentEarnedTimestamp}:R> - ${formatExactTime(earnedMsSince)} ago`)
                )
                .setThumbnailAccessory(thumb => thumb.setURL(currentBadgeUrl));

            let nextLevelSection = null;
            let nextBadgeUrl = '';
            if (nextTierNum) {
                const nextEmojiStr = emojis[`boost_${nextTierNum}`] || '';
                const nextMonths = [0, 1, 2, 3, 6, 9, 12, 15, 18, 24][nextTierNum] || 24;
                nextBadgeUrl = `attachment://discordboost${nextTierNum}.png`;
                
                let timeRemContent = 'Soon';
                if (boostData.timeRemainingMs != null) {
                    const nextEarnedTimestamp = Math.floor((Date.now() + boostData.timeRemainingMs) / 1000);
                    timeRemContent = `<t:${nextEarnedTimestamp}:R> - In ${formatExactTime(boostData.timeRemainingMs)}`;
                }

                nextLevelSection = new SectionBuilder()
                    .addTextDisplayComponents(
                        td => td.setContent(`${nextEmojiStr} **Level ${nextTierNum}** ${nextEmojiStr} (${nextMonths} Month${nextMonths !== 1 ? 's' : ''})`),
                        td => td.setContent(`-# (Next Level)`),
                        td => td.setContent(`-# ${emojis.icon_time} Time Remaining: ${timeRemContent}`)
                    )
                    .setThumbnailAccessory(thumb => thumb.setURL(nextBadgeUrl));
            }

            const container = new ContainerBuilder()
                .setAccentColor(0xff73fa)
                .addSectionComponents(profileSection)
                .addSeparatorComponents(sep => sep)
                .addSectionComponents(currentLevelSection);

            if (nextLevelSection) {
                container.addSeparatorComponents(sep => sep);
                container.addSectionComponents(nextLevelSection);
            }

            const { generateBoostCard } = require('../../utils/canvasHelper');
            const buffer = await generateBoostCard(boostData, target.displayAvatarURL({ extension: 'png', size: 512 }));
            
            const files = [];
            if (currentBadgeUrl.startsWith('attachment://')) {
                const badgePath = path.join(__dirname, '../../assets/badges/boost', `discordboost${boostData.badgeTier}.png`);
                files.push(new AttachmentBuilder(badgePath, { name: `discordboost${boostData.badgeTier}.png` }));
            }
            if (nextBadgeUrl.startsWith('attachment://')) {
                const badgePath = path.join(__dirname, '../../assets/badges/boost', `discordboost${nextTierNum}.png`);
                files.push(new AttachmentBuilder(badgePath, { name: `discordboost${nextTierNum}.png` }));
            }
            
            files.push(new AttachmentBuilder(buffer, { name: 'boost_canvas.png' }));

            const canvasMediaGallery = new MediaGalleryBuilder().addItems(
                item => item.setDescription('معلومات البوست').setURL('attachment://boost_canvas.png')
            );
            
            container.addMediaGalleryComponents(canvasMediaGallery);

            const payload = { 
                components: [container],
                files: files,
                flags: MessageFlags.IsComponentsV2
            };

            return payload;
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
