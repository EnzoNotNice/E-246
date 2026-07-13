const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const Parser = require('rss-parser');
const { resolveYouTubeChannelId, isValidYouTubeChannelId } = require('../utils/youtubeResolve');
const parser = new Parser();

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('[SocialPoller] YouTube polling started...');

        setInterval(async () => {
            try {
                const alerts = db.getAllSocialAlerts();
                if (!alerts || alerts.length === 0) return;

                for (const alert of alerts) {
                    if (alert.platform !== 'youtube') continue;

                    const guild = client.guilds.cache.get(alert.guildId);
                    if (!guild) continue;

                    const channel = guild.channels.cache.get(alert.channelId);
                    if (!channel) continue;

                    try {
                        let channelId = alert.socialId;
                        if (!isValidYouTubeChannelId(channelId)) {
                            channelId = await resolveYouTubeChannelId(alert.socialId);
                            if (channelId && channelId !== alert.socialId) {
                                db.updateSocialAlertSocialId(alert.id, channelId);
                            }
                        }

                        if (!isValidYouTubeChannelId(channelId)) {
                            console.error(`[SocialPoller] Invalid YouTube channel id for ${alert.socialId}`);
                            continue;
                        }

                        const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
                        if (feed.items && feed.items.length > 0) {
                            const latestVideo = feed.items[0];
                            const videoId = latestVideo.id.replace('yt:video:', '');

                            if (alert.lastVideoId !== videoId) {
                                const messageStr = alert.message || 'مقطع جديد! {url}';
                                const content = messageStr
                                    .replace('{url}', latestVideo.link)
                                    .replace('{title}', latestVideo.title)
                                    .replace('{author}', latestVideo.author);

                                const embed = new EmbedBuilder()
                                    .setColor(0xFF0000)
                                    .setAuthor({ name: latestVideo.author || 'YouTube', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo_2015.png' })
                                    .setTitle(latestVideo.title)
                                    .setURL(latestVideo.link)
                                    .setImage(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
                                    .setFooter({ text: 'YouTube Alerts', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo_2015.png' })
                                    .setTimestamp(new Date(latestVideo.pubDate));

                                await channel.send({ content: content, embeds: [embed] });
                                db.updateSocialAlertLastVideo(alert.id, videoId);
                                console.log(`[SocialPoller] Sent YouTube alert for ${channelId} to ${channel.name}`);
                            }
                        }
                    } catch (err) {
                        console.error(`[SocialPoller] Error polling YouTube for ${alert.socialId}:`, err.message);
                    }
                }
            } catch (error) {
                console.error('[SocialPoller] General error:', error);
            }
        }, 300000);
    }
};
