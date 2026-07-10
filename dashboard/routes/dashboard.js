const express = require('express');
const router = express.Router();
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const os = require('os');
const fs = require('fs');
const path = require('path');
function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function safeColor(value, fallback = '#5865F2') {
    return isHexColor(value) ? value : fallback;
}

function safeUrl(value) {
    if (!value) return '';
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? value : '';
    } catch {
        return '';
    }
}

function channelExists(guild, id) {
    return !id || guild.channels.cache.has(id);
}

function roleExists(guild, id) {
    return !id || guild.roles.cache.has(id);
}

function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/login');
}

module.exports = (client) => {
    async function checkGuildAccess(req, res, next) {
        const guildId = req.params.id;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard?error=not_in_guild');

        const userGuild = req.user.guilds.find(g => g.id === guildId);
        if (!userGuild) return res.redirect('/dashboard?error=no_access');

        const perms = BigInt(userGuild.permissions);
        const hasPerms = (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);

        if (!hasPerms) return res.redirect('/dashboard?error=missing_perms');

        req.guild = guild;
        next();
    }

    router.get('/', checkAuth, (req, res) => {
        const userGuilds = req.user.guilds.filter(g => {
            const perms = BigInt(g.permissions);
            return (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);
        });

        const totalGuilds = client.guilds.cache.size;
        const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const uptimeString = `${days}d ${hours}h ${minutes}m`;

        const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const stats = {
            totalGuilds,
            totalUsers,
            uptime: uptimeString,
            ram: `${memUsed} MB`,
            ping: `${client.ws.ping} ms`
        };

        res.render('dashboard', {
            guilds: userGuilds,
            botGuilds: client.guilds.cache,
            stats
        });
    });

    router.get('/admin/botsettings', checkAuth, async (req, res) => {
        let isOwner = false;
        if (process.env.OWNER_ID && req.user.id === process.env.OWNER_ID) isOwner = true;
        if (!isOwner && client.application) {
            await client.application.fetch().catch(()=>null);
            if (client.application.owner) {
                if (client.application.owner.members) {
                    if (client.application.owner.members.has(req.user.id)) isOwner = true;
                } else if (client.application.owner.id === req.user.id) {
                    isOwner = true;
                }
            }
        }

        if (!isOwner) {
            return res.redirect('/dashboard?error=not_owner');
        }
        res.render('botsettings', {
            bot: client.user,
            settings: db.getBotSettings()
        });
    });

    router.post('/admin/botsettings', checkAuth, async (req, res) => {
        let isOwner = false;
        if (process.env.OWNER_ID && req.user.id === process.env.OWNER_ID) isOwner = true;
        if (!isOwner && client.application) {
            await client.application.fetch().catch(()=>null);
            if (client.application.owner) {
                if (client.application.owner.members) {
                    if (client.application.owner.members.has(req.user.id)) isOwner = true;
                } else if (client.application.owner.id === req.user.id) {
                    isOwner = true;
                }
            }
        }

        if (!isOwner) {
            return res.redirect('/dashboard?error=not_owner');
        }
        const { status, activity_type, activity_name } = req.body;
        db.updateBotSettings(status, activity_type, activity_name);
        
        const { ActivityType } = require('discord.js');
        const actType = ActivityType[activity_type] || ActivityType.Playing;

        client.user.setPresence({
            activities: [{ name: activity_name, type: actType }],
            status: status,
        });

        res.redirect('/dashboard/admin/botsettings?success=تم+تحديث+إعدادات+البوت');
    });

    router.get('/:id', checkAuth, checkGuildAccess, (req, res) => {
        const guildId = req.guild.id;
        res.render('server', {
            guild: req.guild,
            settings: db.getGuildSettings(guildId),
            memberStats: db.getDailyMembersStats(guildId, 7),
            messageStats: db.getHourlyMessagesStats(guildId),
            voiceStats: db.getDailyVoiceStats(guildId, 7)
        });
    });

    router.post('/:id/general', checkAuth, checkGuildAccess, (req, res) => {
        const { prefix, log_channel, reply_type } = req.body;
        if (prefix) db.setGuildSetting(req.guild.id, 'prefix', prefix);
        if (log_channel) db.setGuildSetting(req.guild.id, 'log_channel', log_channel === 'none' ? null : log_channel);
        if (reply_type) db.setGuildSetting(req.guild.id, 'reply_type', reply_type);
        res.redirect(`/dashboard/${req.guild.id}?success=تم+تحديث+الإعدادات+بنجاح`);
    });

    router.get('/:id/levels', checkAuth, checkGuildAccess, (req, res) => {
        res.render('levels', {
            guild: req.guild,
            settings: db.getLevelSettings(req.guild.id)
        });
    });

    router.post('/:id/levels', checkAuth, checkGuildAccess, (req, res) => {
        const { enabled, channel, xp_min, xp_max } = req.body;
        db.db.prepare(`
            INSERT INTO level_settings (guildId, enabled, channel, xp_min, xp_max)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guildId) DO UPDATE SET
            enabled = ?, channel = ?, xp_min = ?, xp_max = ?
        `).run(
            req.guild.id, parseInt(enabled), channel || null, parseInt(xp_min), parseInt(xp_max),
            parseInt(enabled), channel || null, parseInt(xp_min), parseInt(xp_max)
        );
        res.redirect(`/dashboard/${req.guild.id}/levels?success=تم+تحديث+إعدادات+المستويات`);
    });

    router.get('/:id/welcome', checkAuth, checkGuildAccess, (req, res) => {
        res.render('welcome', {
            guild: req.guild,
            settings: db.getGreetSettings(req.guild.id)
        });
    });

    router.post('/:id/welcome', checkAuth, checkGuildAccess, (req, res) => {
        const { enabled, channel, message, image_url, avatar_x, avatar_y, avatar_size, username_x, username_y, username_color, username_size } = req.body;
        db.db.prepare(`
            INSERT INTO greet_settings (guildId, enabled, channel, message, image_url, avatar_x, avatar_y, avatar_size, username_x, username_y, username_color, username_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guildId) DO UPDATE SET
            enabled = ?, channel = ?, message = ?, image_url = ?, avatar_x = ?, avatar_y = ?, avatar_size = ?, username_x = ?, username_y = ?, username_color = ?, username_size = ?
        `).run(
            req.guild.id, parseInt(enabled), channel || null, message, image_url || null, parseInt(avatar_x) || 100, parseInt(avatar_y) || 100, parseInt(avatar_size) || 150, parseInt(username_x) || 100, parseInt(username_y) || 300, username_color || '#ffffff', parseInt(username_size) || 40,
            parseInt(enabled), channel || null, message, image_url || null, parseInt(avatar_x) || 100, parseInt(avatar_y) || 100, parseInt(avatar_size) || 150, parseInt(username_x) || 100, parseInt(username_y) || 300, username_color || '#ffffff', parseInt(username_size) || 40
        );
        res.redirect(`/dashboard/${req.guild.id}/welcome?success=تم+تحديث+إعدادات+الترحيب`);
    });

    router.post('/:id/welcome/upload', checkAuth, checkGuildAccess, (req, res) => {
        try {
            const { image } = req.body;
            if (!image || !image.startsWith('data:image/')) {
                return res.json({ success: false, error: 'Invalid image data' });
            }

            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = image.split(';')[0].split('/')[1] || 'png';
            
            const uploadDir = path.join(__dirname, '../../database/uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const fileName = `welcome_${req.guild.id}.${ext}`;
            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, buffer);

            const imageUrl = `/uploads/${fileName}?t=${Date.now()}`;
            
            // Optionally, we could save the image_url to the DB directly here, 
            // but the user clicks "Save Changes" on the form which posts to /:id/welcome 
            
            res.json({ success: true, url: imageUrl });
        } catch (e) {
            console.error('Upload Error:', e);
            res.json({ success: false, error: 'Failed to upload image' });
        }
    });

    router.get('/:id/tempvoice', checkAuth, checkGuildAccess, (req, res) => {
        res.render('tempvoice', {
            guild: req.guild,
            settings: db.getTempVoiceSettings(req.guild.id),
            channels: req.guild.channels.cache.filter(c => c.type === 2), 
            categories: req.guild.channels.cache.filter(c => c.type === 4) 
        });
    });

    router.post('/:id/tempvoice', checkAuth, checkGuildAccess, (req, res) => {
        const { master_channel, category_id } = req.body;
        db.updateTempVoiceSettings(req.guild.id, master_channel || null, category_id || null);
        res.redirect(`/dashboard/${req.guild.id}/tempvoice?success=تم+تحديث+إعدادات+الرومات+المؤقتة`);
    });

    router.get('/:id/protection', checkAuth, checkGuildAccess, (req, res) => {
        res.render('protection', {
            guild: req.guild,
            settings: db.getProtection(req.guild.id)
        });
    });

    router.post('/:id/protection', checkAuth, checkGuildAccess, (req, res) => {
        const { enabled, ban_limit, kick_limit, action } = req.body;
        db.db.prepare(`
            INSERT INTO protection_settings (guildId, enabled, ban_limit, kick_limit, action)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guildId) DO UPDATE SET
            enabled = ?, ban_limit = ?, kick_limit = ?, action = ?
        `).run(
            req.guild.id, parseInt(enabled), parseInt(ban_limit), parseInt(kick_limit), action,
            parseInt(enabled), parseInt(ban_limit), parseInt(kick_limit), action
        );
        res.redirect(`/dashboard/${req.guild.id}/protection?success=تم+تحديث+إعدادات+الحماية`);
    });

    router.get('/:id/autoreplies', checkAuth, checkGuildAccess, (req, res) => {
        res.render('autoreplies', {
            guild: req.guild,
            replies: db.getAutoReplies(req.guild.id)
        });
    });

    router.post('/:id/autoreplies', checkAuth, checkGuildAccess, (req, res) => {
        const { trigger, response } = req.body;
        if (trigger && response) {
            db.addAutoReply(req.guild.id, trigger, response);
        }
        res.redirect(`/dashboard/${req.guild.id}/autoreplies?success=تمت+إضافة+الرد+التلقائي`);
    });

    router.post('/:id/autoreplies/delete', checkAuth, checkGuildAccess, (req, res) => {
        const { trigger } = req.body;
        if (trigger) {
            db.removeAutoReply(req.guild.id, trigger);
        }
        res.redirect(`/dashboard/${req.guild.id}/autoreplies?success=تم+حذف+الرد+التلقائي`);
    });

    router.get('/:id/aliases', checkAuth, checkGuildAccess, (req, res) => {
        res.render('aliases', {
            guild: req.guild,
            aliases: db.getAliases(req.guild.id)
        });
    });

    router.post('/:id/aliases', checkAuth, checkGuildAccess, (req, res) => {
        const { shortcut, command } = req.body;
        if (shortcut && command) {
            const cleanCommand = command.startsWith(db.getGuildSettings(req.guild.id).prefix) ? command.slice(1) : command;
            db.addAlias(req.guild.id, shortcut, cleanCommand);
        }
        res.redirect(`/dashboard/${req.guild.id}/aliases?success=تمت+إضافة+الاختصار`);
    });

    router.post('/:id/aliases/delete', checkAuth, checkGuildAccess, (req, res) => {
        const { shortcut } = req.body;
        if (shortcut) {
            db.removeAlias(req.guild.id, shortcut);
        }
        res.redirect(`/dashboard/${req.guild.id}/aliases?success=تم+حذف+الاختصار`);
    });

    router.get('/:id/logs', checkAuth, checkGuildAccess, (req, res) => {
        res.render('logs', {
            guild: req.guild,
            settings: db.getLogSettings(req.guild.id)
        });
    });

    router.post('/:id/logs', checkAuth, checkGuildAccess, (req, res) => {
        const b = req.body;
        db.db.prepare(`
            INSERT INTO log_settings (
                guildId, ban_channel, unban_channel, kick_channel, timeout_channel, warn_channel,
                message_delete_channel, message_edit_channel, member_join_channel, member_leave_channel,
                channel_create_channel, channel_delete_channel, role_create_channel, role_delete_channel, nick_change_channel
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guildId) DO UPDATE SET
                ban_channel = ?, unban_channel = ?, kick_channel = ?, timeout_channel = ?, warn_channel = ?,
                message_delete_channel = ?, message_edit_channel = ?, member_join_channel = ?, member_leave_channel = ?,
                channel_create_channel = ?, channel_delete_channel = ?, role_create_channel = ?, role_delete_channel = ?, nick_change_channel = ?
        `).run(
            req.guild.id,
            b.ban_channel || null, b.unban_channel || null, b.kick_channel || null, b.timeout_channel || null, b.warn_channel || null,
            b.message_delete_channel || null, b.message_edit_channel || null, b.member_join_channel || null, b.member_leave_channel || null,
            b.channel_create_channel || null, b.channel_delete_channel || null, b.role_create_channel || null, b.role_delete_channel || null, b.nick_change_channel || null,

            b.ban_channel || null, b.unban_channel || null, b.kick_channel || null, b.timeout_channel || null, b.warn_channel || null,
            b.message_delete_channel || null, b.message_edit_channel || null, b.member_join_channel || null, b.member_leave_channel || null,
            b.channel_create_channel || null, b.channel_delete_channel || null, b.role_create_channel || null, b.role_delete_channel || null, b.nick_change_channel || null
        );
        res.redirect(`/dashboard/${req.guild.id}/logs?success=تم+تحديث+إعدادات+السجلات`);
    });

    router.get('/:id/tickets', checkAuth, checkGuildAccess, (req, res) => {
        res.render('tickets', {
            guild: req.guild,
            settings: db.getTicketSettings(req.guild.id),
            roles: req.guild.roles.cache.sort((a, b) => b.position - a.position),
            channels: req.guild.channels.cache.filter(c => c.type === 0 || c.type === 5),
            categories: req.guild.channels.cache.filter(c => c.type === 4)
        });
    });

    router.post('/:id/tickets', checkAuth, checkGuildAccess, async (req, res) => {
        const b = req.body;

        if (!channelExists(req.guild, b.category_id) || !channelExists(req.guild, b.log_channel) || !channelExists(req.guild, b.panel_channel) || !roleExists(req.guild, b.staff_role)) {
            return res.redirect(`/dashboard/${req.guild.id}/tickets?error=Invalid+channel+or+role`);
        }

        const panelData = {
            title: b.title || 'تذاكر الدعم',
            description: b.description || 'اضغط على الزر أدناه لفتح تذكرة دعم',
            color: safeColor(b.color),
            thumbnail: safeUrl(b.thumbnail),
            image: safeUrl(b.image),
            comp_type: b.comp_type || 'button',
            label: b.comp_label || 'فتح تذكرة',
            emoji: b.comp_emoji || '🎫'
        };

        db.updateTicketSettings(req.guild.id, {
            category_id: b.category_id || null,
            log_channel: b.log_channel || null,
            staff_role: b.staff_role || null,
            panel_channel: b.panel_channel || null,
            ticket_message: b.ticket_message || 'شكراً لفتح تذكرة، سيتواصل معك فريق الدعم قريباً.',
            panel_data: JSON.stringify(panelData)
        });

        if (b.send_panel === 'yes' && b.panel_channel) {
            try {
                const pChannel = req.guild.channels.cache.get(b.panel_channel);
                if (pChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(parseInt(panelData.color.replace('#', ''), 16))
                        .setTitle(panelData.title.substring(0, 256))
                        .setDescription(panelData.description.substring(0, 4096));

                    if (panelData.thumbnail) embed.setThumbnail(panelData.thumbnail);
                    if (panelData.image) embed.setImage(panelData.image);

                    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
                    const row = new ActionRowBuilder();

                    if (panelData.comp_type === 'button') {
                        const btn = new ButtonBuilder()
                            .setCustomId('ticket_create_btn')
                            .setLabel(panelData.label.substring(0, 80))
                            .setStyle(ButtonStyle.Primary);
                        if (panelData.emoji) btn.setEmoji(panelData.emoji);
                        row.addComponents(btn);
                    } else {
                        const sel = new StringSelectMenuBuilder()
                            .setCustomId('ticket_create_select')
                            .setPlaceholder('اختر خياراً...')
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(panelData.label.substring(0, 100))
                                    .setValue('open_ticket_opt')
                            );
                        if (panelData.emoji) sel.options[0].setEmoji(panelData.emoji);
                        row.addComponents(sel);
                    }

                    await pChannel.send({ embeds: [embed], components: [row] });
                }
            } catch (e) {
                console.error("Error sending advanced ticket panel via dashboard", e);
            }
        }
        res.redirect(`/dashboard/${req.guild.id}/tickets?success=تم+تحديث+إعدادات+التذاكر`);
    });

    router.get('/:id/embed', checkAuth, checkGuildAccess, (req, res) => {
        res.render('embedbuilder', {
            guild: req.guild,
            channels: req.guild.channels.cache.filter(c => c.type === 0 || c.type === 5)
        });
    });

    router.post('/:id/embed', checkAuth, checkGuildAccess, async (req, res) => {
        const b = req.body;
        if (!b.channel) return res.redirect(`/dashboard/${req.guild.id}/embed?error=No+channel+selected`);

        try {
            const targetChannel = req.guild.channels.cache.get(b.channel);
            if (!targetChannel) throw new Error("Channel not found");

            const embed = new EmbedBuilder()
                .setColor(parseInt(safeColor(b.color).replace('#', ''), 16));

            const authorIcon = safeUrl(b.author_icon);
            const footerIcon = safeUrl(b.footer_icon);
            const image = safeUrl(b.image);
            const thumbnail = safeUrl(b.thumbnail);

            if (b.author_name) embed.setAuthor({ name: b.author_name.substring(0, 256), iconURL: authorIcon || null });
            if (b.title) embed.setTitle(b.title.substring(0, 256));
            if (b.description) embed.setDescription(b.description.substring(0, 4096));
            if (image) embed.setImage(image);
            if (thumbnail) embed.setThumbnail(thumbnail);

            if (b.footer_text) embed.setFooter({ text: b.footer_text.substring(0, 2048), iconURL: footerIcon || null });
            if (b.timestamp === 'true') embed.setTimestamp();

            if (!b.title && !b.description && !b.image && !b.author_name && !b.footer_text) {
                return res.redirect(`/dashboard/${req.guild.id}/embed?error=Embed+must+have+some+content+(title,+description,+author,+etc)`);
            }

            await targetChannel.send({ embeds: [embed] });
            res.redirect(`/dashboard/${req.guild.id}/embed?success=تم+إرسال+الإمبيد+بنجاح`);
        } catch (e) {
            console.error("Dashboard Embed Builder Error:", e);
            res.redirect(`/dashboard/${req.guild.id}/embed?error=Failed+to+send+embed`);
        }
    });

    router.get('/:id/reactionroles', checkAuth, checkGuildAccess, (req, res) => {
        const settings = db.getReactionRoles(req.guild.id);
        if (typeof settings.panel_data === 'string') settings.panel_data = JSON.parse(settings.panel_data || '{}');
        if (typeof settings.roles_data === 'string') settings.roles_data = settings.roles_data;

        const nativeReactionRoles = db.db.prepare('SELECT * FROM reactroles WHERE guildId = ?').all(req.guild.id);

        res.render('reactionroles', {
            guild: req.guild,
            settings,
            client,
            nativeReactionRoles,
            roles: req.guild.roles.cache.sort((a, b) => b.position - a.position).map(r => ({id: r.id, name: r.name})),
            textChannels: req.guild.channels.cache.filter(c => c.type === 0 || c.type === 5)
        });
    });

    router.post('/:id/reactionroles', checkAuth, checkGuildAccess, async (req, res) => {
        const b = req.body;

        const panelData = {
            title: b.title || 'اختر رتبك',
            description: b.description || 'اضغط على الأزرار أدناه للحصول على الرتب',
            color: safeColor(b.color),
            thumbnail: safeUrl(b.thumbnail),
            image: safeUrl(b.image),
            comp_type: b.comp_type || 'button'
        };

        const rolesData = b.roles_data || '[]';

        db.updateReactionRoles(req.guild.id, {
            panel_data: JSON.stringify(panelData),
            roles_data: rolesData
        });

        if (b.send_panel === 'yes' && b.panel_channel) {
            try {
                const targetChannel = req.guild.channels.cache.get(b.panel_channel);
                if (targetChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(parseInt(panelData.color.replace('#', ''), 16))
                        .setTitle(panelData.title.substring(0, 256))
                        .setDescription(panelData.description.substring(0, 4096));

                    if (panelData.thumbnail) embed.setThumbnail(panelData.thumbnail);
                    if (panelData.image) embed.setImage(panelData.image);

                    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
                    const parsedRoles = JSON.parse(rolesData);
                    const components = [];

                    if (panelData.comp_type === 'button') {
                        for (let i = 0; i < parsedRoles.length; i += 5) {
                            const chunk = parsedRoles.slice(i, i + 5);
                            const row = new ActionRowBuilder();
                            chunk.forEach((r, idx) => {
                                const btn = new ButtonBuilder()
                                    .setCustomId(`rr_${r.roleId}_${i + idx}`)
                                    .setStyle(ButtonStyle.Secondary);

                                if (r.label) btn.setLabel(r.label.substring(0, 80));
                                if (r.emoji) btn.setEmoji(r.emoji);
                                if (!r.label && !r.emoji) btn.setLabel('رتبة');
                                row.addComponents(btn);
                            });
                            components.push(row);
                        }
                    } else {
                        const row = new ActionRowBuilder();
                        const sel = new StringSelectMenuBuilder()
                            .setCustomId('rr_select')
                            .setPlaceholder('اختر رتبك...')
                            .setMinValues(0)
                            .setMaxValues(Math.min(parsedRoles.length, 25));

                        const options = parsedRoles.map(r => {
                            const opt = new StringSelectMenuOptionBuilder()
                                .setLabel(r.label || 'رتبة')
                                .setValue(`rr_opt_${r.roleId}`);
                            if (r.emoji) opt.setEmoji(r.emoji);
                            return opt;
                        });
                        sel.addOptions(options);
                        row.addComponents(sel);
                        components.push(row);
                    }

                    await targetChannel.send({ embeds: [embed], components });
                }
            } catch (e) {
                console.error("Error sending reaction roles panel", e);
                return res.redirect(`/dashboard/${req.guild.id}/reactionroles?error=Failed+to+send+panel`);
            }
        }

        res.redirect(`/dashboard/${req.guild.id}/reactionroles?success=تم+حفظ+الرتب`);
    });

    router.get('/:id/forms', checkAuth, checkGuildAccess, (req, res) => {
        const settings = db.getFormsSettings(req.guild.id);
        if (typeof settings.panel_data === 'string') settings.panel_data = JSON.parse(settings.panel_data || '{}');

        res.render('forms', {
            guild: req.guild,
            settings,
            client,
            textChannels: req.guild.channels.cache.filter(c => c.type === 0 || c.type === 5)
        });
    });

    router.post('/:id/forms', checkAuth, checkGuildAccess, async (req, res) => {
        const b = req.body;

        if (!channelExists(req.guild, b.log_channel) || !channelExists(req.guild, b.panel_channel)) {
            return res.redirect(`/dashboard/${req.guild.id}/forms?error=Invalid+channel`);
        }

        const panelData = {
            title: b.title || 'نموذج التقديم',
            description: b.description || 'اضغط على الزر أدناه للتقديم.',
            color: safeColor(b.color),
            thumbnail: safeUrl(b.thumbnail),
            image: safeUrl(b.image)
        };

        const questionsData = b.questions || '[]';

        db.updateFormsSettings(req.guild.id, {
            log_channel: b.log_channel,
            panel_data: JSON.stringify(panelData),
            questions: questionsData
        });

        if (b.send_panel === 'yes' && b.panel_channel) {
            try {
                const targetChannel = req.guild.channels.cache.get(b.panel_channel);
                if (targetChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(parseInt(panelData.color.replace('#', ''), 16))
                        .setTitle(panelData.title.substring(0, 256))
                        .setDescription(panelData.description.substring(0, 4096));

                    if (panelData.thumbnail) embed.setThumbnail(panelData.thumbnail);
                    if (panelData.image) embed.setImage(panelData.image);

                    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('form_apply_btn')
                            .setLabel('قدّم الآن')
                            .setEmoji('📝')
                            .setStyle(ButtonStyle.Primary)
                    );

                    await targetChannel.send({ embeds: [embed], components: [row] });
                }
            } catch (e) {
                console.error("Error sending forms panel", e);
                return res.redirect(`/dashboard/${req.guild.id}/forms?error=Failed+to+send+panel`);
            }
        }

        res.redirect(`/dashboard/${req.guild.id}/forms?success=تم+حفظ+التقديم`);
    });

    router.get('/:id/captcha', checkAuth, checkGuildAccess, (req, res) => {
        const settings = db.getCaptchaSettings(req.guild.id);
        if (typeof settings.panel_data === 'string') settings.panel_data = JSON.parse(settings.panel_data || '{}');

        res.render('captcha', {
            guild: req.guild,
            settings,
            client,
            roles: req.guild.roles.cache.sort((a, b) => b.position - a.position).map(r => ({id: r.id, name: r.name})),
            textChannels: req.guild.channels.cache.filter(c => c.type === 0 || c.type === 5)
        });
    });

    router.post('/:id/captcha', checkAuth, checkGuildAccess, async (req, res) => {
        const b = req.body;

        if (!channelExists(req.guild, b.panel_channel) || !roleExists(req.guild, b.unverified_role) || !roleExists(req.guild, b.verified_role)) {
            return res.redirect(`/dashboard/${req.guild.id}/captcha?error=Invalid+channel+or+role`);
        }

        const panelData = {
            title: b.title || 'التحقق من السيرفر',
            description: b.description || 'للوصول إلى بقية السيرفر، اضغط على الزر أدناه وحل التحقق.',
            color: safeColor(b.color, '#57F287'),
            btn_text: b.btn_text || 'تحقق',
            btn_emoji: b.btn_emoji || '✅',
            btn_style: b.btn_style || 'Success'
        };

        db.updateCaptchaSettings(req.guild.id, {
            enabled: parseInt(b.enabled) || 0,
            unverified_role: b.unverified_role || null,
            verified_role: b.verified_role || null,
            panel_channel: b.panel_channel || null,
            panel_data: JSON.stringify(panelData)
        });

        if (b.send_panel === 'yes' && b.panel_channel) {
            try {
                const targetChannel = req.guild.channels.cache.get(b.panel_channel);
                if (targetChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(parseInt(panelData.color.replace('#', ''), 16))
                        .setTitle(panelData.title.substring(0, 256))
                        .setDescription(panelData.description.substring(0, 4096));

                    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                    const btn = new ButtonBuilder()
                        .setCustomId('verify_start')
                        .setLabel(panelData.btn_text)
                        .setStyle(ButtonStyle[panelData.btn_style]);

                    if (panelData.btn_emoji) {
                        btn.setEmoji(panelData.btn_emoji);
                    }

                    const row = new ActionRowBuilder().addComponents(btn);

                    await targetChannel.send({ embeds: [embed], components: [row] });
                }
            } catch (e) {
                console.error("Error sending captcha panel", e);
                return res.redirect(`/dashboard/${req.guild.id}/captcha?error=Failed+to+send+panel`);
            }
        }

        res.redirect(`/dashboard/${req.guild.id}/captcha?success=تم+حفظ+إعدادات+التحقق`);
    });

    router.get('/:id/stats', checkAuth, checkGuildAccess, (req, res) => {
        const topMessages = db.db.prepare('SELECT * FROM levels WHERE guildId = ? ORDER BY messages DESC LIMIT 10').all(req.guild.id);
        const topVoice = db.db.prepare('SELECT * FROM levels WHERE guildId = ? ORDER BY voice_xp DESC LIMIT 10').all(req.guild.id);
        const topReactions = db.db.prepare('SELECT * FROM levels WHERE guildId = ? ORDER BY reactionsCount DESC LIMIT 10').all(req.guild.id);

        res.render('stats', {
            guild: req.guild,
            topMessages,
            topVoice,
            topReactions
        });
    });

    router.post('/:id/reactionroles/delete', checkAuth, checkGuildAccess, (req, res) => {
        const { messageId, emoji } = req.body;
        db.db.prepare('DELETE FROM reactroles WHERE guildId = ? AND messageId = ? AND emoji = ?').run(req.guild.id, messageId, emoji);
        res.redirect(`/dashboard/${req.guild.id}/reactionroles?success=تم+حذف+الرتبة+التفاعلية+بنجاح`);
    });

    router.get('/:id/alerts', checkAuth, checkGuildAccess, (req, res) => {
        const alerts = db.getSocialAlerts(req.guild.id);
        res.render('alerts', {
            guild: req.guild,
            alerts,
            textChannels: req.guild.channels.cache.filter(c => c.type === 0 || c.type === 5)
        });
    });

    router.post('/:id/alerts/add', checkAuth, checkGuildAccess, async (req, res) => {
        const { platform, channelId, socialId, message } = req.body;
        
        if (!channelExists(req.guild, channelId)) {
            return res.redirect(`/dashboard/${req.guild.id}/alerts?error=Invalid+channel`);
        }
        if (!socialId) {
            return res.redirect(`/dashboard/${req.guild.id}/alerts?error=Missing+ID`);
        }

        let actualSocialId = socialId.trim();
        
        
        if (platform === 'youtube') {
            if (actualSocialId.includes('youtube.com/channel/')) {
                actualSocialId = actualSocialId.split('youtube.com/channel/')[1].split('/')[0];
            } else if (actualSocialId.includes('youtube.com/@')) {
                 
                 
            }
        }

        db.addSocialAlert(req.guild.id, platform, channelId, actualSocialId, message || 'مقطع جديد! {url}');
        res.redirect(`/dashboard/${req.guild.id}/alerts?success=تمت+إضافة+التنبيه+بنجاح`);
    });

    router.post('/:id/alerts/delete', checkAuth, checkGuildAccess, (req, res) => {
        const { id } = req.body;
        if (id) {
            db.removeSocialAlert(id, req.guild.id);
        }
        res.redirect(`/dashboard/${req.guild.id}/alerts?success=تم+حذف+التنبيه`);
    });

    return router;
};
