const { EmbedBuilder, AttachmentBuilder, AuditLogEvent } = require('discord.js');
const Canvas = require('@napi-rs/canvas');
const path = require('path');
Canvas.registerFont = (fontPath, options) => {
  try {
    const { GlobalFonts } = require('@napi-rs/canvas');
    GlobalFonts.registerFromPath(fontPath, options.family);
  } catch (e) {
    logger.error('Failed to register font with napi-rs:', e);
  }
};
Canvas.registerFont(path.join(__dirname, '..', 'assets', 'font.ttf'), { family: 'CustomFont' });
const db = require('../database/db');
const logger = require('../utils/logger');
const { sendLog } = logger;

const raidJoins = new Map();
const activeLockdowns = new Map();

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      if (!member?.guild) return;
      const guild = member.guild;
      const guildId = guild.id;
      const client = member.client;

      const protection = db.getProtection(guildId);
      if (protection && protection.antiraid && !member.user?.bot) {
        const now = Date.now();
        let joins = raidJoins.get(guildId) || [];
        joins = joins.filter((t) => now - t < 10000);
        joins.push(now);
        raidJoins.set(guildId, joins);

        if (joins.length >= 8) {
          await member.kick('Anti-Raid: Suspected Raid Attack').catch(() => null);

          // Check if Auto-Lockdown is already triggered recently (cooldown: 5 minutes)
          const lastLockdown = activeLockdowns.get(guildId) || 0;
          let lockedCount = 0;

          if (now - lastLockdown > 300000) {
            activeLockdowns.set(guildId, now);

            // Execute Emergency Auto-Lockdown on server channels
            try {
              const textChannels = guild.channels.cache.filter(
                (c) => c.isTextBased() && !c.isDMBased() && !c.isThread()
              );

              for (const [, ch] of textChannels) {
                const perms = ch.permissionsFor(guild.roles.everyone);
                if (perms && perms.has('SendMessages')) {
                  await ch.permissionOverwrites
                    .edit(
                      guild.roles.everyone,
                      { SendMessages: false },
                      { reason: 'Anti-Raid Auto-Lockdown: Emergency Raid Mitigation' }
                    )
                    .catch(() => null);
                  lockedCount++;
                }
              }
            } catch (err) {
              logger.error('[Anti-Raid Auto-Lockdown Error]:', err);
            }

            // Emergency Audit Log Embed
            const emergencyEmbed = new EmbedBuilder()
              .setTitle('{emoji:shieldlock} 🚨 تفعيل الإغلاق التلقائي الطارئ (Anti-Raid Auto-Lockdown)')
              .setColor(0xff0000)
              .setDescription(
                `⚠️ **تحذير أمني عالي الخطورة!**\n` +
                  `تم رصد هجوم انضمام جماعي مريب (\`${joins.length}\` حسابات انضمت خلال 10 ثوانٍ).\n\n` +
                  `🛡️ **الإجراءات التلقائية المتخذة:**\n` +
                  `• **الإغلاق التلقائي (Auto-Lockdown):** تم قفل إرسال الرسائل لـ \`@everyone\` في \`${lockedCount}\` قناة نصية فوراً.\n` +
                  `• **طرد العضو المريب:** تم طرد <@${member.id}> (\`${member.user?.tag || member.id}\`).\n` +
                  `• **وقت التفعيل:** <t:${Math.floor(now / 1000)}:F>`
              )
              .setFooter({ text: 'E-246 Anti-Raid Defense System' })
              .setTimestamp();

            await sendLog(client, guildId, emergencyEmbed, 'protection').catch(() => null);
            return;
          }

          // If lockdown was already active, still kick and send individual alert
          const embed = new EmbedBuilder()
            .setTitle('{emoji:shieldlock} حماية الرايد')
            .setColor(0xff0000)
            .setDescription(`تم طرد <@${member.id}> بسبب الاستمرار في انضمام جماعي مريب أثناء وضع الحماية.`)
            .setTimestamp();
          await sendLog(client, guildId, embed, 'protection').catch(() => null);
          return;
        }
      }

      if (member.user?.bot) {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 }).catch(() => null);
        const entry = auditLogs ? auditLogs.entries.first() : null;
        if (entry && entry.targetId === member.id && entry.executor) {
          const executor = entry.executor;
          if (
            executor.id !== guild.ownerId &&
            !db.isWhitelisted(guildId, executor.id) &&
            executor.id !== client.user?.id
          ) {
            await member.kick('إضافة بوت غير مصرح به').catch(() => null);
            const executorMember = await guild.members.fetch(executor.id).catch(() => null);
            if (executorMember) {
              await executorMember.roles.set([]).catch(() => null);
            }
            const embed = new EmbedBuilder()
              .setTitle('{emoji:shield} إضافة بوت غير مصرح به')
              .setColor(0xff0000)
              .addFields(
                { name: 'البوت المضاف', value: `<@${member.id}>`, inline: true },
                { name: 'الفاعل (المشرف)', value: `<@${executor.id}>`, inline: true },
                { name: 'الإجراء المتخذ', value: 'تم طرد البوت المضاف، وتجريد المشرف من كافة رتبه', inline: false }
              )
              .setTimestamp();
            await sendLog(client, guildId, embed, 'protection');
            return;
          }
        }
      }

      db.incrementDailyJoins(guildId);

      // ── Sticky Roles Restoration ──
      try {
        const stickySettings = db.getStickyRoleSettings(guildId);
        if (stickySettings?.enabled && !member.user?.bot) {
          const savedSticky = db.getStickyRoles(guildId, member.id);
          if (savedSticky?.roleIds?.length > 0) {
            const botMember = guild.members.me;
            const botHighest = botMember?.roles?.highest?.position || 0;
            const rolesToRestore = savedSticky.roleIds.filter((roleId) => {
              const role = guild.roles.cache.get(roleId);
              return role && !role.managed && role.position < botHighest;
            });

            if (rolesToRestore.length > 0) {
              await member.roles.add(rolesToRestore, 'Sticky Roles Restoration upon rejoining').catch(() => null);
              const restoreEmbed = new EmbedBuilder()
                .setTitle('{emoji:shieldcheck} استعادة الرتب التلقائية (Sticky Roles)')
                .setColor(0x57f287)
                .setDescription(
                  `تمت استعادة **${rolesToRestore.length}** رتبة للعضو <@${member.id}> بعد عودته للسيرفر تلقائياً.`
                )
                .setTimestamp();
              await sendLog(client, guildId, restoreEmbed, 'moderation').catch(() => null);
            }
          }
        }
      } catch (err) {
        logger.error('[StickyRoles Restore Error]', err);
      }

      try {
        const cachedInvites = client.inviteCache.get(guildId) || new Map();
        const newInvites = await guild.invites.fetch().catch(() => null);

        if (newInvites) {
          let usedInvite = null;
          for (const [code, invite] of newInvites) {
            const cachedUses = cachedInvites.get(code) || 0;
            if (invite.uses > cachedUses) {
              usedInvite = invite;
              break;
            }
          }

          client.inviteCache.set(guildId, new Map(newInvites.map((i) => [i.code, i.uses])));

          if (usedInvite && usedInvite.inviter) {
            const inviterId = usedInvite.inviter.id;
            db.updateInvites(inviterId, guildId, 'total', 1);

            const accountAge = Date.now() - (member.user?.createdTimestamp || Date.now());
            if (accountAge < 7 * 24 * 60 * 60 * 1000) {
              db.updateInvites(inviterId, guildId, 'fake', 1);
            }

            const inviterData = db.getInvites(inviterId, guildId);
            const real = inviterData.total - inviterData.fake - inviterData.left;
            const ranks = db.getInviteRanks(guildId);

            for (const rank of ranks) {
              if (real >= rank.count) {
                const inviterMember = await guild.members.fetch(inviterId).catch(() => null);
                if (inviterMember && !inviterMember.roles.cache.has(rank.roleId)) {
                  inviterMember.roles.add(rank.roleId).catch(() => null);
                }
              }
            }

            const inviteLogs = db.getInviteLogs(guildId);
            if (inviteLogs?.channelId) {
              const logCh = await client.channels.fetch(inviteLogs.channelId).catch(() => null);
              if (logCh) {
                const invEmbed = new EmbedBuilder()
                  .setColor(0x57f287)
                  .setTitle('{emoji:mail} انضمام عضو')
                  .setThumbnail(member.user?.displayAvatarURL())
                  .setDescription(
                    `${member} انضم\n**تمت دعوته بواسطة** <@${inviterId}> (${real} دعوات حقيقية)\n**كود الدعوة** \`${usedInvite.code}\``
                  )
                  .setTimestamp();
                logCh.send({ embeds: [invEmbed] }).catch(() => null);
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors in invite tracking
      }

      const greet = db.getGreetSettings(guildId);
      if (greet.enabled && greet.channel) {
        const greetChannel = await client.channels.fetch(greet.channel).catch(() => null);
        if (greetChannel) {
          const message = (greet.message || 'Welcome {user} to **{server}**! Member count: **{count}**')
            .replace(/{user}/g, member.toString())
            .replace(/{server}/g, guild.name)
            .replace(/{count}|{memberCount}|{members}|{total}/gi, guild.memberCount.toString());

          let imagePathOrUrl = greet.image_url;
          if (imagePathOrUrl && imagePathOrUrl.startsWith('/uploads/')) {
            const cleanPath = imagePathOrUrl.split('?')[0];
            const fileName = cleanPath.substring('/uploads/'.length);
            imagePathOrUrl = path.join(__dirname, '..', 'database', 'uploads', fileName);
          }

          let attachment;
          if (greet.image_url) {
            try {
              const bg = await Canvas.loadImage(imagePathOrUrl);
              const canvasWidth = bg.width;
              const canvasHeight = bg.height;

              const canvas = Canvas.createCanvas(canvasWidth, canvasHeight);
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(bg, 0, 0, canvasWidth, canvasHeight);

              const ax = greet.avatar_x !== null && greet.avatar_x !== undefined ? greet.avatar_x : 100;
              const ay = greet.avatar_y !== null && greet.avatar_y !== undefined ? greet.avatar_y : 100;
              const avatarSize =
                greet.avatar_size !== null && greet.avatar_size !== undefined ? greet.avatar_size : 150;

              const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: 'png', size: 1024 }));
              ctx.save();
              ctx.beginPath();
              ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
              ctx.restore();

              const ux = greet.username_x !== null && greet.username_x !== undefined ? greet.username_x : 100;
              const uy = greet.username_y !== null && greet.username_y !== undefined ? greet.username_y : 300;
              const uSize =
                greet.username_size !== null && greet.username_size !== undefined ? greet.username_size : 40;
              const uColor = greet.username_color || '#ffffff';

              ctx.font = `${Math.round(uSize)}px CustomFont`;
              ctx.fillStyle = uColor;
              ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;

              ctx.fillText(member.user?.username || '', ux, uy);

              attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome.png' });
            } catch (err) {
              logger.warn('[Welcome] Custom image rendering failed, sending text message instead:', err.message || err);
            }
          }

          let sent;
          if (attachment) {
            sent = await greetChannel.send({ content: message, files: [attachment] }).catch(() => null);
          } else {
            sent = await greetChannel.send({ content: message }).catch(() => null);
          }

          if (sent && greet.delete_after > 0) {
            setTimeout(() => sent.delete().catch(() => null), greet.delete_after * 1000);
          }
        }
      }

      if (greet.dm_message && member.user && !member.user.bot) {
        const dm = greet.dm_message.replace('{user}', member.user.username || '').replace('{server}', guild.name);
        member.user.send({ content: dm }).catch(() => null);
      }

      const autoRoleId = greet.auto_role || greet.role;
      if (autoRoleId && !member.user?.bot) {
        const roleObj = guild.roles.cache.get(autoRoleId) || (await guild.roles.fetch(autoRoleId).catch(() => null));
        if (roleObj) {
          await member.roles.add(roleObj).catch((err) => logger.error('[Welcome] Failed to give auto-role:', err));
        }
      }

      const createdUnix = Math.floor((member.user?.createdTimestamp || Date.now()) / 1000);
      const logEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('{emoji:mail} انضمام عضو جديد')
        .setThumbnail(member.user?.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'العضو', value: `${member} (${member.user?.tag || 'مجهول'})`, inline: true },
          { name: 'معرف العضو', value: `\`${member.id}\``, inline: true },
          { name: 'تاريخ إنشاء الحساب', value: `<t:${createdUnix}:R> (<t:${createdUnix}:F>)`, inline: false },
          { name: 'إجمالي أعضاء السيرفر', value: `\`${guild.memberCount}\``, inline: true }
        )
        .setTimestamp();

      await sendLog(client, guildId, logEmbed, 'member_join');
    } catch (err) {
      logger.error('Error in guildMemberAdd event:', err);
    }
  }
};
