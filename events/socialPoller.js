const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const Parser = require('rss-parser');
const { resolveYouTubeChannelId, isValidYouTubeChannelId } = require('../utils/youtubeResolve');
const logger = require('../utils/logger');
const parser = new Parser();

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    try {
      logger.info('[SocialPoller] YouTube polling started...');

      setInterval(async () => {
        try {
          const alerts = db.getAllSocialAlerts();
          if (!alerts || alerts.length === 0) return;

          for (const alert of alerts) {
            const channel =
              client.channels.cache.get(alert.channelId) ||
              (await client.channels.fetch(alert.channelId).catch(() => null));
            if (!channel) continue;

            // ── YouTube Alert Handler ──────────────────────────────
            if (alert.platform === 'youtube') {
              try {
                let channelId = alert.socialId;
                if (!isValidYouTubeChannelId(channelId)) {
                  channelId = await resolveYouTubeChannelId(alert.socialId);
                  if (channelId && channelId !== alert.socialId) {
                    db.updateSocialAlertSocialId(alert.id, channelId);
                  }
                }

                if (!isValidYouTubeChannelId(channelId)) {
                  logger.error(`[SocialPoller] Invalid YouTube channel id for ${alert.socialId}`);
                  continue;
                }

                const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
                if (feed.items && feed.items.length > 0) {
                  const latestVideo = feed.items[0];
                  const videoId = latestVideo.id.replace('yt:video:', '');

                  if (alert.lastVideoId !== videoId) {
                    const messageStr = alert.message || '🔴 مقطع جديد! {url}';
                    const content = messageStr
                      .replace('{url}', latestVideo.link)
                      .replace('{title}', latestVideo.title)
                      .replace('{author}', latestVideo.author || channelId)
                      .replace('{platform}', 'YouTube');

                    const embed = new EmbedBuilder()
                      .setColor(0xff0000)
                      .setAuthor({
                        name: latestVideo.author || 'YouTube',
                        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo_2015.png'
                      })
                      .setTitle(latestVideo.title)
                      .setURL(latestVideo.link)
                      .setImage(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
                      .setFooter({
                        text: 'YouTube Alerts',
                        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo_2015.png'
                      })
                      .setTimestamp(new Date(latestVideo.pubDate));

                    await channel
                      .send({ content, embeds: [embed] })
                      .catch((err) => logger.error('[SocialPoller Send Error]', err));
                    db.updateSocialAlertLastVideo(alert.id, videoId);
                    logger.info(`[SocialPoller] Sent YouTube alert for ${channelId} to ${channel.name}`);
                  }
                }
              } catch (err) {
                logger.error(`[SocialPoller] Error polling YouTube for ${alert.socialId}:`, err.message);
              }
            }

            // ── Twitch Live Stream Handler ──────────────────────────
            if (alert.platform === 'twitch') {
              try {
                const streamer = alert.socialId.toLowerCase().trim();
                const res = await fetch('https://gql.twitch.tv/gql', {
                  method: 'POST',
                  headers: {
                    'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    query: `query { user(login: "${streamer}") { displayName profileImageURL(width: 300) stream { id title game { name } viewersCount previewImageURL(width: 1280, height: 720) } } }`
                  }),
                  signal: AbortSignal.timeout(8000)
                }).catch(() => null);

                if (res && res.ok) {
                  const data = await res.json().catch(() => null);
                  const user = data?.data?.user;
                  const stream = user?.stream;

                  if (stream && stream.id) {
                    if (alert.lastVideoId !== stream.id) {
                      const streamUrl = `https://twitch.tv/${streamer}`;
                      const messageStr = alert.message || '🟣 {author} بث مباشر الآن على {platform}! {url}';
                      const content = messageStr
                        .replace('{url}', streamUrl)
                        .replace('{title}', stream.title || 'Live Stream')
                        .replace('{author}', user.displayName || streamer)
                        .replace('{platform}', 'Twitch');

                      const preview = stream.previewImageURL
                        ? stream.previewImageURL.replace('{width}', '1280').replace('{height}', '720')
                        : `https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamer}-1280x720.jpg`;

                      const embed = new EmbedBuilder()
                        .setColor(0x9146ff)
                        .setAuthor({
                          name: `${user.displayName || streamer} (Twitch)`,
                          iconURL: user.profileImageURL || 'https://assets.help.twitch.tv/Glitch_Purple_RGB.png',
                          url: streamUrl
                        })
                        .setTitle(stream.title || `${user.displayName || streamer} is LIVE on Twitch!`)
                        .setURL(streamUrl)
                        .addFields(
                          { name: 'اللعبة / الفئة', value: stream.game?.name || 'Just Chatting', inline: true },
                          { name: 'المشاهدات', value: `\`${stream.viewersCount || 0}\``, inline: true }
                        )
                        .setImage(preview)
                        .setFooter({
                          text: 'Twitch Stream Alerts',
                          iconURL: 'https://assets.help.twitch.tv/Glitch_Purple_RGB.png'
                        })
                        .setTimestamp();

                      await channel
                        .send({ content, embeds: [embed] })
                        .catch((err) => logger.error('[SocialPoller Twitch Send Error]', err));
                      db.updateSocialAlertLastVideo(alert.id, stream.id);
                      logger.info(`[SocialPoller] Sent Twitch alert for ${streamer} to ${channel.name}`);
                    }
                  }
                }
              } catch (err) {
                logger.error(`[SocialPoller] Error polling Twitch for ${alert.socialId}:`, err.message);
              }
            }

            // ── Kick Live Stream Handler ────────────────────────────
            if (alert.platform === 'kick') {
              try {
                const streamer = alert.socialId.toLowerCase().trim();
                const res = await fetch(`https://kick.com/api/v2/channels/${streamer}`, {
                  headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  },
                  signal: AbortSignal.timeout(8000)
                }).catch(() => null);

                if (res && res.ok) {
                  const data = await res.json().catch(() => null);
                  const livestream = data?.livestream;

                  if (livestream && livestream.is_live && livestream.id) {
                    const streamId = String(livestream.id);
                    if (alert.lastVideoId !== streamId) {
                      const streamUrl = `https://kick.com/${streamer}`;
                      const messageStr = alert.message || '🟢 {author} بث مباشر الآن على {platform}! {url}';
                      const authorName = data?.user?.username || streamer;
                      const content = messageStr
                        .replace('{url}', streamUrl)
                        .replace('{title}', livestream.session_title || 'Live Stream')
                        .replace('{author}', authorName)
                        .replace('{platform}', 'Kick');

                      const embed = new EmbedBuilder()
                        .setColor(0x53fc18)
                        .setAuthor({
                          name: `${authorName} (Kick)`,
                          iconURL: data?.user?.profile_pic || 'https://kick.com/favicon.ico',
                          url: streamUrl
                        })
                        .setTitle(livestream.session_title || `${authorName} is LIVE on Kick!`)
                        .setURL(streamUrl)
                        .addFields(
                          {
                            name: 'الفئة',
                            value: livestream.categories?.[0]?.name || 'Just Chatting',
                            inline: true
                          },
                          { name: 'المشاهدات', value: `\`${livestream.viewer_count || 0}\``, inline: true }
                        )
                        .setImage(livestream.thumbnail?.url || null)
                        .setFooter({ text: 'Kick Stream Alerts', iconURL: 'https://kick.com/favicon.ico' })
                        .setTimestamp();

                      await channel
                        .send({ content, embeds: [embed] })
                        .catch((err) => logger.error('[SocialPoller Kick Send Error]', err));
                      db.updateSocialAlertLastVideo(alert.id, streamId);
                      logger.info(`[SocialPoller] Sent Kick alert for ${streamer} to ${channel.name}`);
                    }
                  }
                }
              } catch (err) {
                logger.error(`[SocialPoller] Error polling Kick for ${alert.socialId}:`, err.message);
              }
            }
          }
        } catch (error) {
          logger.error('[SocialPoller] General error:', error);
        }
      }, 300000);
    } catch (err) {
      logger.error('Error in socialPoller execute:', err);
    }
  }
};
