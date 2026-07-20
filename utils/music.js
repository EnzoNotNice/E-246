const { LavalinkManager } = require('lavalink-client');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } = require('discord.js');
const { applyEpicPlayer } = require('./EpicPlayer');
const db = require('../database/db');

function formatDuration(ms) {
    if (!ms) return '0:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function setupMusic(client) {
    client.deletedMessages = new WeakSet();
    client.isMessageDeleted = (msg) => client.deletedMessages.has(msg);
    client.markMessageAsDeleted = (msg) => client.deletedMessages.add(msg);
    
    let playedTracks = [];

    
    
    let nodes = [];
    if (process.env.LAVALINK_NODES) {
        nodes = process.env.LAVALINK_NODES.split(',').map(nodeStr => {
            const [host, port, password] = nodeStr.split(':');
            return {
                authorization: password || 'youshallnotpass',
                host: host || 'localhost',
                port: parseInt(port) || 2333,
                id: host,
                secure: false
            };
        });
    }

    if (nodes.length === 0) {
        console.warn('[Music] No Lavalink nodes found in .env (LAVALINK_NODES). Music system will be disabled or fail to connect.');
    }

    client.manager = new LavalinkManager({
        nodes: nodes,
        client: {
            id: process.env.CLIENT_ID,
            username: 'E-246 Music'
        },
        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        playerOptions: {
            defaultSearchPlatform: 'ytsearch',
            volumeDecrementer: 0.75,
        },
        queueOptions: {
            maxPreviousTracks: 10,
        },
        autoSkip: true,
    });

    client.manager.nodeManager.on('connect', (node) => console.log(`[Music] Node: ${node.id} connected.`));
    client.manager.nodeManager.on('reconnecting', (node) => console.log(`[Music] Node: ${node.id} reconnecting.`));
    client.manager.nodeManager.on('disconnect', (node) => console.log(`[Music] Node: ${node.id} disconnected.`));
    client.manager.nodeManager.on('error', (node, err) => console.error(`[Music] Node: ${node.id} error: ${err.message}`));

    client.manager.on('playerCreate', (player) => {
        applyEpicPlayer(player);
        player.set('autoQueue', false);
        player.set('twentyFourSeven', false);
    });

    client.manager.on('playerDestroy', (player) => {
        player.setNowplayingMessage(client, null);
    });

    client.manager.on('playerMove', (player, oldChannel, newChannel) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;
        const channel = guild.channels.cache.get(player.textChannelId);
        if (oldChannel === newChannel) return;
        if (!newChannel) {
            if (channel) {
                channel.send({
                    embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`{emoji:circlex} **انقطع الاتصال وتم الخروج من <#${oldChannel}>**`)],
                }).catch(() => {});
            }
            return player.destroy();
        } else {
            player.voiceChannelId = newChannel;
            setTimeout(() => player.pause(false), 1000);
        }
    });

    client.manager.on('trackStart', async (player, track) => {
        playedTracks.push(track.info.identifier);
        if (playedTracks.length >= 100) playedTracks.shift();

        const title = escapeMarkdown(track.info.title).replace(/\]/g, '').replace(/\[/g, '');

        const trackEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: 'تشتغل الآن 🎶', iconURL: client.user.displayAvatarURL() })
            .setDescription(`[${title}](${track.info.uri})`)
            .addFields(
                { name: '{emoji:user} بطلب من', value: `${track.requester ?? `<@${client.user.id}>`}`, inline: true },
                { name: '{emoji:clock} المدة', value: track.info.isStream ? `\`🔴 بث مباشر\`` : `\`${formatDuration(track.info.duration)}\``, inline: true }
            );

        try {
            trackEmbed.setThumbnail(`https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`);
        } catch {
            trackEmbed.setThumbnail(track.info.artworkUrl ?? null);
        }

        const nowPlaying = await client.channels.cache.get(player.textChannelId)?.send({
            embeds: [trackEmbed],
            components: [createController(player.guildId, player)],
        }).catch(() => null);

        player.setNowplayingMessage(client, nowPlaying);
    });

    client.manager.on('trackError', (player, track, payload) => {
        const title = escapeMarkdown(track.info.title).replace(/[\[\]]/g, '');
        const errorEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('{emoji:alerttriangle} خطأ في التشغيل!')
            .setDescription(`فشل تشغيل المقطع: \`${title}\``)
            .setFooter({ text: payload?.exception?.message || 'Unknown error' });
        client.channels.cache.get(player.textChannelId)?.send({ embeds: [errorEmbed] }).catch(() => {});
    });

    client.manager.on('queueEnd', async (player, track) => {
        const autoQueue = player.get('autoQueue');

        if (autoQueue) {
            const identifier = track.info.identifier;
            const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
            const res = await player.search({ query: search }, player.get('requester')).catch(() => null);

            if (!res || res.loadType === 'error' || res.loadType === 'empty') {
                return player.destroy();
            }

            const nextTrack = res.tracks.find((t) => !playedTracks.includes(t.info.identifier));
            if (nextTrack) {
                await player.queue.add(nextTrack);
                await player.play({ paused: false });
            }
            return;
        }

        const twentyFourSeven = player.get('twentyFourSeven');

        const queueEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: 'انتهت قائمة التشغيل', iconURL: client.user.displayAvatarURL() })
            .setDescription('لم يعد هناك مقاطع في القائمة.')
            .setTimestamp();

        const endMsg = await client.channels.cache.get(player.textChannelId)?.send({ embeds: [queueEmbed] }).catch(() => null);
        if (endMsg) setTimeout(() => endMsg.delete().catch(() => {}), 10000);

        if (!player.playing && !twentyFourSeven) {
            setTimeout(async () => {
                if (!player.playing && player.connected) {
                    const disconnEmbed = new EmbedBuilder()
                        .setColor(0xED4245)
                        .setDescription('تم قطع الاتصال بسبب الخمول.');
                    const disconnMsg = await client.channels.cache.get(player.textChannelId)?.send({ embeds: [disconnEmbed] }).catch(() => null);
                    if (disconnMsg) setTimeout(() => disconnMsg.delete().catch(() => {}), 6000);
                    player.destroy();
                }
            }, 60000); 
        }
        player.setNowplayingMessage(client, null);
    });

    
    client.createController = createController;
}

function createController(guildId, player) {
    const fs = require('fs');
    const path = require('path');
    let emojis = {};
    try {
        const emojisPath = path.join(__dirname, 'emojis.json');
        if (fs.existsSync(emojisPath)) {
            emojis = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));
        }
    } catch (e) {
        
    }

    const stopEmoji = emojis.music_stop || '⏹️';
    const replayEmoji = emojis.music_replay || '🔁';
    const playEmoji = emojis.music_play || '▶️';
    const pauseEmoji = emojis.music_pause || '⏸️';
    const nextEmoji = emojis.music_next || '⏭️';
    const loopTrackEmoji = emojis.music_loop_track || '🔂';
    const loopQueueEmoji = emojis.music_replay || '🔁';
    const loopNoneEmoji = emojis.music_loop_none || '🔄';

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`controller:${guildId}:Stop`)
            .setEmoji(stopEmoji),
        new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`controller:${guildId}:Replay`)
            .setEmoji(replayEmoji),
        new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`controller:${guildId}:PlayAndPause`)
            .setEmoji(!player.paused ? pauseEmoji : playEmoji),
        new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`controller:${guildId}:Next`)
            .setEmoji(nextEmoji),
        new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`controller:${guildId}:Loop`)
            .setEmoji(player.repeatMode === 'track' ? loopTrackEmoji : player.repeatMode === 'queue' ? loopQueueEmoji : loopNoneEmoji)
    );
}

module.exports = { setupMusic };
