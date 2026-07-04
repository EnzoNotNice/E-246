const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');
const path = require('path');
Canvas.registerFont(path.join(__dirname, '..', 'assets', 'font.ttf'), { family: 'CustomFont' });
const db = require('../database/db');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member.guild;
    const guildId = guild.id;
    const client = member.client;

    db.incrementDailyJoins(guildId);

    
    try {
      const cachedInvites = client.inviteCache.get(guildId) || new Map();
      const newInvites = await guild.invites.fetch();

      let usedInvite = null;
      for (const [code, invite] of newInvites) {
        const cachedUses = cachedInvites.get(code) || 0;
        if (invite.uses > cachedUses) {
          usedInvite = invite;
          break;
        }
      }

      
      client.inviteCache.set(guildId, new Map(newInvites.map(i => [i.code, i.uses])));

      if (usedInvite && usedInvite.inviter) {
        const inviterId = usedInvite.inviter.id;
        db.updateInvites(inviterId, guildId, 'total', 1);

        
        const accountAge = Date.now() - member.user.createdTimestamp;
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
              .setColor(0x57F287)
              .setTitle('<:mail:1519212229445029971> انضمام عضو')
              .setThumbnail(member.user.displayAvatarURL())
              .setDescription(`${member} انضم\n**تمت دعوته بواسطة** <@${inviterId}> (${real} دعوات حقيقية)\n**كود الدعوة** \`${usedInvite.code}\``)
              .setTimestamp();
            logCh.send({ embeds: [invEmbed] }).catch(() => null);
          }
        }
      }
    } catch (e) {
      
    }

    
    const greet = db.getGreetSettings(guildId);
    if (greet.enabled && greet.channel) {
      const greetChannel = await client.channels.fetch(greet.channel).catch(() => null);
      if (greetChannel) {
        const message = (greet.message || 'Welcome {user} to **{server}**!')
          .replace(/{user}/g, member.toString())
          .replace(/{server}/g, guild.name)
          .replace(/{count}/g, guild.memberCount.toString());

        let imagePathOrUrl = greet.image_url;
        if (imagePathOrUrl.startsWith('/uploads/')) {
            const cleanPath = imagePathOrUrl.split('?')[0];
            const fileName = cleanPath.substring('/uploads/'.length);
            imagePathOrUrl = path.join(__dirname, '..', 'database', 'uploads', fileName);
        }

        let attachment;
        if (greet.image_url) {
            try {
                const bg = await Canvas.loadImage(imagePathOrUrl);
                const canvas = Canvas.createCanvas(bg.width, bg.height);
                const ctx = canvas.getContext('2d');

                
                ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

                
                const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: 'png', size: 1024 }));
                const avatarSize = greet.avatar_size || 150;
                const ax = greet.avatar_x || 100;
                const ay = greet.avatar_y || 100;

                ctx.save();
                ctx.beginPath();
                ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
                ctx.restore();

                
                const ux = greet.username_x || 100;
                const uy = greet.username_y || 300;
                const uSize = greet.username_size || 40;
                const uColor = greet.username_color || '#ffffff';

                ctx.font = `${uSize}px CustomFont`;
                ctx.fillStyle = uColor;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                
                ctx.fillText(member.user.username, ux, uy);

                attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome.png' });
            } catch (err) {
                console.error('Welcome Image Error:', err);
            }
        }

        let sent;
        if (attachment) {
            sent = await greetChannel.send({ content: message, files: [attachment] }).catch(() => null);
        } else {
            const greetEmbed = new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription(message)
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setTimestamp();
            sent = await greetChannel.send({ embeds: [greetEmbed] }).catch(() => null);
        }

        if (sent && greet.delete_after > 0) {
          setTimeout(() => sent.delete().catch(() => null), greet.delete_after * 1000);
        }
      }

      
      if (greet.dm_message) {
        const dm = greet.dm_message
          .replace('{user}', member.user.username)
          .replace('{server}', guild.name);
        member.user.send({ content: dm }).catch(() => null);
      }
    }

    
    const logEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('<:mail:1519212229445029971> انضمام عضو')
      .setDescription(`${member} انضم للسيرفر\n**تاريخ إنشاء الحساب** <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>\n**عدد الأعضاء** ${guild.memberCount}`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await sendLog(client, guildId, logEmbed, 'member_join');
  }
};
