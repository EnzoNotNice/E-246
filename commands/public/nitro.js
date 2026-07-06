const { SlashCommandBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, AttachmentBuilder, MediaGalleryBuilder } = require('discord.js');
const { getUserNitroInfo } = require('../../utils/selfbotHelper');
const { formatExactTime, getDaysSince, getMsSince } = require('../../utils/timeFormatters');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nitro')
        .setDescription('معلومات نيترو لعضو')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('العضو لمعلومات النيترو')),
    async getNitroPayload(target, userToken) {
        try {
            const nitroRes = await getUserNitroInfo(userToken, target.id);
            
            if (!nitroRes.success) {
                return {
                    content: `❌ فشل في جلب بيانات النيترو للعضو. السبب: ${nitroRes.error}`,
                    components: [],
                    files: []
                };
            }

            const nitroData = nitroRes.data;
 
            if (!nitroData.hasNitro) {
                const noNitroText = new TextDisplayBuilder().setContent(`**${target.username}** ليس لديه اشتراك نيترو نشط`);
                return {
                    components: [noNitroText],
                    flags: MessageFlags.IsComponentsV2
                };
            }

            const typeName = nitroData.premiumType === 2 ? 'Gaming' : (nitroData.premiumType === 1 ? 'Classic' : 'Basic');
            const msSince = getMsSince(nitroData.premiumSince);
            const daysSince = getDaysSince(nitroData.premiumSince);

            const emojis = require('../../utils/emojis.json');
            const profileTimestamp = Math.floor(new Date(nitroData.premiumSince).getTime() / 1000);

            const profileSection = new SectionBuilder()
                .addTextDisplayComponents(
                    td => td.setContent(`**${emojis.nitro_progression} ${target.displayName} Nitro Progression**\n<@${target.id}> \`(${target.username})\``),
                    td => td.setContent(`-# ${emojis.nitro_type} Nitro Type: \`${typeName}\``),
                    td => td.setContent(`-# ${emojis.icon_time} Nitro Since: <t:${profileTimestamp}:R> - ${formatExactTime(msSince)}`)
                )
                .setThumbnailAccessory(thumb => thumb.setURL(target.displayAvatarURL({ extension: 'png', size: 512 })));

            const currentBadgeName = (nitroData.currentTier === 'none' ? 'Normal' : nitroData.currentTier.charAt(0).toUpperCase() + nitroData.currentTier.slice(1));
            const currentBadgeMonths = nitroData.progressStart || 0;
            const currentEmojiStr = emojis[`nitro_${nitroData.currentBadge === 'none' || !nitroData.currentBadge ? 'normal' : nitroData.currentBadge}`] || '';
            
            let currentBadgeUrl = '';
            let currentBadgeFile = '';
            if (nitroData.currentBadge === 'none' || !nitroData.currentBadge) {
                currentBadgeUrl = 'attachment://normal.png';
                currentBadgeFile = 'normal.png';
            } else {
                currentBadgeUrl = `attachment://${nitroData.currentBadge}.png`;
                currentBadgeFile = `${nitroData.currentBadge}.png`;
            }

            const earnedMsSince = getMsSince(nitroData.currentBadgeEarnedDate);
            const currentEarnedTimestamp = Math.floor(new Date(nitroData.currentBadgeEarnedDate).getTime() / 1000);
            
            const currentLevelSection = new SectionBuilder()
                .addTextDisplayComponents(
                    td => td.setContent(`${currentEmojiStr} **${currentBadgeName}** ${currentEmojiStr} (${currentBadgeMonths} Month${currentBadgeMonths !== 1 ? 's' : ''})`),
                    td => td.setContent(`-# (Current Level)`),
                    td => td.setContent(`-# ${emojis.icon_earned} Earned: <t:${currentEarnedTimestamp}:R> - ${formatExactTime(earnedMsSince)} ago`)
                )
                .setThumbnailAccessory(thumb => thumb.setURL(currentBadgeUrl));

            let nextLevelSection = null;
            let nextBadgeUrl = '';
            if (nitroData.nextTier) {
                const nextBadgeName = nitroData.nextTier.charAt(0).toUpperCase() + nitroData.nextTier.slice(1);
                const nextBadgeMonths = nitroData.progressEnd || 0;
                const nextEmojiStr = emojis[`nitro_${nitroData.nextTier}`] || '';
                nextBadgeUrl = `attachment://${nitroData.nextTier}.png`;
                
                let timeRemContent = 'Soon';
                if (nitroData.timeRemainingMs != null) {
                    const nextEarnedTimestamp = Math.floor((Date.now() + nitroData.timeRemainingMs) / 1000);
                    timeRemContent = `<t:${nextEarnedTimestamp}:R> - In ${formatExactTime(nitroData.timeRemainingMs)}`;
                }

                nextLevelSection = new SectionBuilder()
                    .addTextDisplayComponents(
                        td => td.setContent(`${nextEmojiStr} **${nextBadgeName}** ${nextEmojiStr} (${nextBadgeMonths} Month${nextBadgeMonths !== 1 ? 's' : ''})`),
                        td => td.setContent(`-# (Next Level)`),
                        td => td.setContent(`-# ${emojis.icon_time} Time Remaining: ${timeRemContent}`)
                    )
                    .setThumbnailAccessory(thumb => thumb.setURL(nextBadgeUrl));
            }

            const container = new ContainerBuilder()
                .setAccentColor(0x0099ff)
                .addSectionComponents(profileSection)
                .addSeparatorComponents(sep => sep)
                .addSectionComponents(currentLevelSection);

            if (nextLevelSection) {
                container.addSeparatorComponents(sep => sep);
                container.addSectionComponents(nextLevelSection);
            }

            const { generateNitroCard } = require('../../utils/canvasHelper');
            const buffer = await generateNitroCard(nitroData, target.displayAvatarURL({ extension: 'png', size: 512 }));
            
            const files = [];
            if (currentBadgeUrl.startsWith('attachment://')) {
                const badgePath = path.join(__dirname, '../../assets/badges/nitro', currentBadgeFile);
                files.push(new AttachmentBuilder(badgePath, { name: currentBadgeFile }));
            }
            if (nextBadgeUrl.startsWith('attachment://')) {
                const badgePath = path.join(__dirname, '../../assets/badges/nitro', `${nitroData.nextTier}.png`);
                files.push(new AttachmentBuilder(badgePath, { name: `${nitroData.nextTier}.png` }));
            }
            
            files.push(new AttachmentBuilder(buffer, { name: 'nitro_canvas.png' }));

            const canvasMediaGallery = new MediaGalleryBuilder().addItems(
                item => item.setDescription('معلومات النيترو').setURL('attachment://nitro_canvas.png')
            );
            
            container.addMediaGalleryComponents(canvasMediaGallery);

            const payload = { 
                components: [container],
                files: files,
                flags: MessageFlags.IsComponentsV2
            };

            return payload;
        } catch (e) {
            console.error("Failed to fetch selfbot nitro stats or generate components", e);
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
            const payload = await module.exports.getNitroPayload(target, userToken);
            await interaction.editReply(payload);
        } catch (e) {
            await interaction.editReply({ content: "An error occurred while fetching Nitro stats." });
        }
    },
};
