const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const locale = require('../utils/locale');
const db = require('../database/db');
const { error } = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    const client = interaction.client;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (e) {
        console.error(`Slash command error [${interaction.commandName}]:`, e);
        const errEmbed = error('Command Error', locale.get('general.errorOccurred', { error: e.message }));
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], flags: ['Ephemeral'] }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [errEmbed], flags: ['Ephemeral'] }).catch(() => null);
        }
      }
      return;
    }

    const handleTicketCreate = async (interaction) => {
      const settings = db.getTicketSettings(interaction.guildId);
      if (!settings.category_id || !settings.staff_role) {
        return interaction.reply({ embeds: [error(locale.get('tickets.notSetup'))], flags: ['Ephemeral'] });
      }

      const existing = db.db.prepare("SELECT * FROM tickets WHERE guildId = ? AND userId = ? AND status = 'open'").get(interaction.guildId, interaction.user.id);
      if (existing) {
        return interaction.reply({ embeds: [error(locale.get('tickets.ticketExists'))], flags: ['Ephemeral'] });
      }

      await interaction.deferReply({ flags: ['Ephemeral'] });

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: settings.category_id,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: settings.staff_role, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
        ]
      });

      db.createTicket(interaction.guildId, interaction.user.id, ticketChannel.id, null);

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x00B0F4)
        .setTitle(`<:ticket:1519212195945119814> ${locale.get('tickets.openedTitle')}`)
        .setDescription(settings.ticket_message || locale.get('tickets.openedDesc'))
        .addFields({ name: `<:user:1519212186633764995> ${locale.get('tickets.userField')}`, value: `${interaction.user}`, inline: true })
        .setTimestamp();

      const { ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
      const closeBtn = locale.getButton('buttons.ticketClose');
      const closeRow = new ARB().addComponents(
        new BB().setCustomId('ticket_close_btn').setLabel(closeBtn.label).setEmoji(closeBtn.emoji).setStyle(BS.Danger)
      );

      await ticketChannel.send({ content: `${interaction.user} <@&${settings.staff_role}>`, embeds: [ticketEmbed], components: [closeRow] });

      if (settings.log_channel) {
        const logCh = await client.channels.fetch(settings.log_channel).catch(() => null);
        if (logCh) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('<:ticket:1519212195945119814> إنشاء تذكرة')
            .setDescription(`**العضو** ${interaction.user.tag}\n**الروم** ${ticketChannel}`)
            .setTimestamp();
          logCh.send({ embeds: [logEmbed] }).catch(() => null);
        }
      }

      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`<:circlecheck:1519212246876557413> ${locale.get('tickets.successCreated', { channel: ticketChannel.toString() })}`)] });
    };

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_create_select') {
            return handleTicketCreate(interaction);
        }

        if (interaction.customId === 'rr_select') {
            await interaction.deferReply({ flags: ['Ephemeral'] });
            const member = interaction.member;
            let added = [];
            let removed = [];
            let failed = [];


            for (const value of interaction.values) {
                if (value.startsWith('rr_opt_')) {
                    const roleId = value.replace('rr_opt_', '');
                    const role = interaction.guild.roles.cache.get(roleId);
                    if (!role) continue;

                    try {
                        if (!member.roles.cache.has(roleId)) {
                            await member.roles.add(roleId);
                            added.push(role.name);
                        }
                    } catch (e) {
                        failed.push(role.name);
                    }
                }
            }

            let msg = '';
            if (added.length > 0) msg += `${locale.get('reactionRoles.roleAdded', { role: added.join(', ') })}\n`;
            if (failed.length > 0) msg += `${locale.get('reactionRoles.roleError')} (${failed.join(', ')})\n`;
            if (!msg) msg = locale.get('reactionRoles.selectSuccess');

            return interaction.editReply({ content: msg });
        }
        if (interaction.customId === 'help_menu') {
            const category = interaction.values[0].replace('help_', '');

            let commandList = [];
            for (const [, cmd] of interaction.client.commands) {
                if (cmd.data && cmd.category === category) {
                    commandList.push(`**/${cmd.data.name}** ${cmd.data.description || 'بدون وصف'}`);
                }
            }

            const emojis = {
                admin: '<:crown:1519212241310715916>',
                public: '<:infocircle:1519212235258335324>',
                giveaway: '<:confetti:1519212243026448394>',
                ticket: '<:ticket:1519212195945119814>',
                protection: '<:lock:1519212231332593785>',
                levels: '<:chartpie:1519212248479043634>',
                automation: '<:adjustments:1519212254720167996>',
                invite: '<:folderopen:1519212239876395138>',
                greet: '<:folder:1519212238160924692>',
                economy: '<:gift:1519212237317865553>'
            };

            const arNames = {
                admin: 'الإدارة',
                public: 'العامة',
                giveaway: 'الجيف أواي',
                ticket: 'التذاكر',
                protection: 'الحماية',
                levels: 'المستويات',
                automation: 'الردود والخطوط',
                invite: 'الدعوات',
                greet: 'الترحيب',
                economy: 'الاقتصاد'
            };

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setTitle(`${emojis[category] || '<:folder:1519212238160924692>'} أوامر ${arNames[category] || category}`)
                .setDescription(commandList.length > 0 ? commandList.join('\n') : 'لا توجد أوامر في هذا القسم حالياً')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.update({ embeds: [embed] }).catch(() => null);
        }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith('box_')) {
        if (id === 'box_claimed') return;

        const parts = id.split('_');
        const hostId = parts[1];
        const prize = decodeURIComponent(parts.slice(3).join('_'));

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('box_claimed').setLabel('تم الاستلام').setEmoji('1519212237317865553').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        const winEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('<:gift:1519212237317865553> تم الاستلام')
          .setDescription(`${interaction.user} استلم صندوق الغموض\n**الجائزة** ${prize}`)
          .setTimestamp();

        await interaction.update({ embeds: [winEmbed], components: [disabledRow] });
        return;
      }

      if (id.startsWith('rr_') && id !== 'rr_select') {
        const parts = id.split('_');
        const roleId = parts[1];

        await interaction.deferReply({ flags: ['Ephemeral'] });

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.editReply({ content: locale.get('reactionRoles.roleNotFound') });
        }

        try {
            if (interaction.member.roles.cache.has(roleId)) {
                await interaction.member.roles.remove(roleId);
                return interaction.editReply({ content: locale.get('reactionRoles.roleRemoved', { role: role.name }) });
            } else {
                await interaction.member.roles.add(roleId);
                return interaction.editReply({ content: locale.get('reactionRoles.roleAdded', { role: role.name }) });
            }
        } catch (e) {
            return interaction.editReply({ content: locale.get('reactionRoles.roleError') });
        }
      }


      if (id === 'form_apply_btn') {
        const settings = db.getFormsSettings(interaction.guildId);
        let questions = [];
        try { questions = JSON.parse(settings.questions || '[]'); } catch(e){}

        if (questions.length === 0) {
            return interaction.reply({ content: locale.get('forms.noQuestions'), flags: ['Ephemeral'] });
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
            .setCustomId('form_submit')
            .setTitle(locale.get('forms.modalTitle').substring(0, 45));

        questions.slice(0, 5).forEach((q, i) => {
            const input = new TextInputBuilder()
                .setCustomId(`question_${i}`)
                .setLabel(q.substring(0, 45))
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
        });

        await interaction.showModal(modal);
        return;
      }

      if (id.startsWith('form_accept_') || id.startsWith('form_reject_')) {
        const isAccept = id.startsWith('form_accept_');
        const userId = id.split('_')[2];

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.setColor(isAccept ? 0x57F287 : 0xED4245);
        embed.setFooter({ text: isAccept ? locale.get('forms.panelAccepted', { user: interaction.user.tag }) : locale.get('forms.panelRejected', { user: interaction.user.tag }) });

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const acceptBtn = locale.getButton('buttons.formAccept');
        const rejectBtn = locale.getButton('buttons.formReject');

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('dummy_1')
                .setLabel(isAccept ? acceptBtn.label : rejectBtn.label)
                .setEmoji(isAccept ? acceptBtn.emoji : rejectBtn.emoji)
                .setStyle(isAccept ? ButtonStyle.Success : ButtonStyle.Danger)
                .setDisabled(true)
        );

        await interaction.update({ embeds: [embed], components: [disabledRow] });

        try {
            const user = await client.users.fetch(userId);
            if (user) {
                user.send({ content: isAccept ? locale.get('forms.dmAccepted', { server: interaction.guild.name }) : locale.get('forms.dmRejected', { server: interaction.guild.name }) }).catch(() => null);
            }
        } catch(e) {}
        return;
      }

      if (id.startsWith('bc_send_')) {
        const target = id.replace('bc_send_', '');
        const bcKey = `${interaction.guildId}:${interaction.user.id}`;

        const messageContent = global.bcCache && global.bcCache.get(bcKey);
        if (!messageContent) {
            return interaction.reply({ content: locale.get('broadcast.sessionExpired'), flags: ['Ephemeral'] });
        }

        await interaction.deferUpdate();

        const row = interaction.message.components[0];
        const newComponents = row.components.map(c => require('discord.js').ButtonBuilder.from(c).setDisabled(true));
        const disabledRow = new (require('discord.js').ActionRowBuilder)().addComponents(newComponents);
        await interaction.editReply({ content: locale.get('broadcast.starting'), components: [disabledRow] });

        let members = await interaction.guild.members.fetch({ withPresences: true }).catch(() => null);
        if (!members) {
            return interaction.followUp({ content: locale.get('broadcast.fetchFailed'), flags: ['Ephemeral'] });
        }

        members = members.filter(m => !m.user.bot);

        if (target === 'online') {
            members = members.filter(m => m.presence && m.presence.status !== 'offline');
        } else if (target === 'offline') {
            members = members.filter(m => !m.presence || m.presence.status === 'offline');
        }

        let sent = 0;
        let failed = 0;

        for (const [memberId, member] of members) {
            try {
                await new Promise(r => setTimeout(r, 1500));

                await member.send({ content: `${messageContent}\n\n${member}` });
                sent++;
            } catch (e) {
                failed++;
            }
        }

        global.bcCache.delete(bcKey);

        return interaction.followUp({ content: locale.get('broadcast.completed', { sent, failed }) }).catch(() => null);
      }

      if (id === 'verify_start') {
        const settings = db.getCaptchaSettings(interaction.guildId);
        if (!settings || !settings.enabled) {
            return interaction.reply({ content: locale.get('captcha.disabled'), flags: ['Ephemeral'] });
        }

        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let text = '';
        for (let i = 0; i < 5; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        if (!global.captchaCache) global.captchaCache = new Map();
        global.captchaCache.set(`${interaction.guildId}:${interaction.user.id}`, text);

        const { createCanvas } = require('canvas');
        const canvas = createCanvas(200, 100);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2b2d31';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for(let i = 0; i < 5; i++) {
            ctx.strokeStyle = '#5865F2';
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for(let i = 0; i < text.length; i++) {
            ctx.save();
            ctx.translate(30 + (i * 35), 50);
            ctx.rotate((Math.random() - 0.5) * 0.4);
            ctx.fillText(text[i], 0, 0);
            ctx.restore();
        }

        const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'captcha.png' });

        const ansBtn = locale.getButton('buttons.captchaAnswer');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('verify_answer').setLabel(ansBtn.label).setEmoji(ansBtn.emoji).setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({
            content: locale.get('captcha.instruction'),
            files: [attachment],
            components: [row],
            flags: ['Ephemeral']
        });
      }

      if (id === 'verify_answer') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
            .setCustomId('verify_submit')
            .setTitle(locale.get('captcha.modalTitle').substring(0, 45));

        const input = new TextInputBuilder()
            .setCustomId('captcha_input')
            .setLabel(locale.get('captcha.modalInput').substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(5);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (id === 'ticket_create' || id === 'ticket_create_btn') {
        return handleTicketCreate(interaction);
      }

      if (id === 'ticket_close_btn' || id === 'ticket_close') {
        const ticket = db.getTicketByChannel(interaction.channelId);
        if (!ticket) return;

        await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false, SendMessages: false });
        db.updateTicketStatus(interaction.channelId, 'closed');

        const { ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
        const delBtn = locale.getButton('buttons.ticketDelete');
        const ropBtn = locale.getButton('buttons.ticketReopen');

        const row = new ARB().addComponents(
          new BB().setCustomId('ticket_delete').setLabel(delBtn.label).setEmoji(delBtn.emoji).setStyle(BS.Danger),
          new BB().setCustomId('ticket_reopen').setLabel(ropBtn.label).setEmoji(ropBtn.emoji).setStyle(BS.Secondary),
        );

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`<:lock:1519212231332593785> ${locale.get('tickets.closedTitle')}`)
          .setDescription(locale.get('tickets.closedDesc', { user: interaction.user.toString() }))
          .setTimestamp();

        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (id === 'ticket_reopen') {
        const ticket = db.getTicketByChannel(interaction.channelId);
        if (!ticket) return;
        await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true });
        db.updateTicketStatus(interaction.channelId, 'open');
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`<:lock:1519212231332593785> ${locale.get('tickets.reopenedDesc', { user: interaction.user.toString() })}`)]
        });
      }

      if (id === 'ticket_delete') {
        const ticketSettings = db.getTicketSettings(interaction.guildId);

        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`<:trash:1519212192912637962> ${locale.get('tickets.deletingDesc')}`)]
        });

        try {
          const discordTranscripts = require('discord-html-transcripts');
          const attachment = await discordTranscripts.createTranscript(interaction.channel, {
              limit: -1,
              returnType: 'attachment',
              filename: `transcript-${interaction.channel.name}.html`,
              saveImages: true,
              footerText: "Exported Ticket Transcript",
              poweredBy: false
          });

          if (ticketSettings && ticketSettings.log_channel) {
              const logCh = await client.channels.fetch(ticketSettings.log_channel).catch(() => null);
              if (logCh) {
                  const logEmbed = new EmbedBuilder()
                      .setColor(0xED4245)
                      .setTitle(`<:trash:1519212192912637962> ${locale.get('tickets.deletedLogTitle')}`)
                      .setDescription(locale.get('tickets.deletedLogDesc', { channel: interaction.channel.name, user: interaction.user.toString() }))
                      .setTimestamp();
                  await logCh.send({ embeds: [logEmbed], files: [attachment] }).catch(console.error);
              }
          }
        } catch (e) {
          console.error("Transcript Error:", e);
        }

        setTimeout(() => interaction.channel.delete().catch(() => null), 3000);
        return;
      }

      // Temp Voice Buttons
      if (id.startsWith('tv_')) {
        const tvChannel = db.getTempVoiceChannel(interaction.channelId);
        if (!tvChannel) {
          const emojis = require('../utils/emojis.json');
          return interaction.reply({ content: `${emojis.circlex || '❌'} **هذه ليست غرفة مؤقتة صالحة**`, flags: ['Ephemeral'] });
        }

        const isOwner = tvChannel.ownerId === interaction.user.id;
        const isTrusted = db.isTempVoiceTrusted(interaction.channelId, interaction.user.id);

        const emojis = require('../utils/emojis.json');

        if (!isOwner && !isTrusted) {
          return interaction.reply({ content: `${emojis.circlex || '❌'} **لا تملك صلاحية التحكم بهذه الغرفة**`, flags: ['Ephemeral'] });
        }

        if ((id === 'tv_trust' || id === 'tv_ban') && !isOwner) {
          return interaction.reply({ content: `${emojis.circlex || '❌'} **هذه الصلاحية لمالك الغرفة الأساسي فقط**`, flags: ['Ephemeral'] });
        }

        const channel = interaction.channel; // In this case, interaction.channel might be the text-in-voice channel or a text channel. But wait, `interaction.channel` is the voice channel!
        if (channel.type !== ChannelType.GuildVoice) {
           return interaction.reply({ content: `${emojis.circlex || '❌'} **يجب استخدام هذه الأزرار داخل الغرفة الصوتية نفسها**`, flags: ['Ephemeral'] });
        }

        if (id === 'tv_lock') {
          await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
          return interaction.reply({ content: `${emojis.tv_lock || '🔒'} **تم قفل الغرفة، لا يمكن للمجهولين الدخول**`, flags: ['Ephemeral'] });
        }
        
        if (id === 'tv_unlock') {
          await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
          return interaction.reply({ content: `${emojis.tv_unlock || '🔓'} **تم فتح الغرفة للجميع**`, flags: ['Ephemeral'] });
        }

        if (id === 'tv_hide') {
          await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
          return interaction.reply({ content: `${emojis.tv_hide || '👁️‍🗨️'} **تم إخفاء الغرفة**`, flags: ['Ephemeral'] });
        }

        if (id === 'tv_show') {
          await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
          return interaction.reply({ content: `${emojis.tv_show || '👁️'} **تم إظهار الغرفة**`, flags: ['Ephemeral'] });
        }

        if (id === 'tv_limit') {
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId('tv_modal_limit').setTitle('تحديد عدد الأشخاص');
          const input = new TextInputBuilder().setCustomId('limit_input').setLabel('العدد (0 مفتوح، الحد الأقصى 99)').setStyle(TextInputStyle.Short).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        if (id === 'tv_rename') {
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId('tv_modal_rename').setTitle('تغيير اسم الغرفة');
          const input = new TextInputBuilder().setCustomId('rename_input').setLabel('الاسم الجديد').setStyle(TextInputStyle.Short).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        if (id === 'tv_kick') {
          const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
            .setCustomId('tv_select_kick')
            .setPlaceholder('اختر الشخص لطرده من الروم')
            .setMaxValues(1);
          
          return interaction.reply({ content: `${emojis.tv_kick || '👢'} **اختر الشخص لطرده من الروم**`, components: [new ActionRowBuilder().addComponents(select)], flags: ['Ephemeral'] });
        }

        if (id === 'tv_trust') {
          const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
            .setCustomId('tv_select_trust')
            .setPlaceholder('اختر الشخص لإضافته أو إزالته كمسؤول مساعد')
            .setMaxValues(1);
          
          return interaction.reply({ content: `${emojis.tv_trust || '👑'} **اختر شخصاً لإعطائه أو سحب صلاحيات المساعد منه في غرفتك الصوتية**`, components: [new ActionRowBuilder().addComponents(select)], flags: ['Ephemeral'] });
        }

        if (id === 'tv_ban') {
          const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
            .setCustomId('tv_select_ban')
            .setPlaceholder('اختر الشخص لحظره أو إلغاء حظره')
            .setMaxValues(1);
          
          return interaction.reply({ content: `${emojis.tv_ban || '🚫'} **اختر شخصاً لحظر أو إلغاء حظر دخوله لغرفتك الصوتية**`, components: [new ActionRowBuilder().addComponents(select)], flags: ['Ephemeral'] });
        }
      }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'verify_submit') {
            const answer = interaction.fields.getTextInputValue('captcha_input');
            const captchaKey = `${interaction.guildId}:${interaction.user.id}`;
            const correctAnswer = global.captchaCache ? global.captchaCache.get(captchaKey) : null;

            if (!correctAnswer) {
                return interaction.reply({ content: locale.get('captcha.expired'), flags: ['Ephemeral'] });
            }

            if (answer.toUpperCase() !== correctAnswer.toUpperCase()) {
                global.captchaCache.delete(captchaKey);
                return interaction.reply({ content: locale.get('captcha.incorrect'), flags: ['Ephemeral'] });
            }

            global.captchaCache.delete(captchaKey);
            const settings = db.getCaptchaSettings(interaction.guildId);
            const member = interaction.member;

            try {
                if (settings.verified_role) await member.roles.add(settings.verified_role);
                if (settings.unverified_role) await member.roles.remove(settings.unverified_role);
                return interaction.reply({ content: locale.get('captcha.success'), flags: ['Ephemeral'] });
            } catch (e) {
                return interaction.reply({ content: locale.get('captcha.roleError'), flags: ['Ephemeral'] });
            }
        }

        if (interaction.customId === 'form_submit') {
            const settings = db.getFormsSettings(interaction.guildId);
            if (!settings.log_channel) {
                return interaction.reply({ content: locale.get('forms.noLogChannel'), flags: ['Ephemeral'] });
            }

            const logCh = interaction.guild.channels.cache.get(settings.log_channel);
            if (!logCh) {
                return interaction.reply({ content: locale.get('forms.noLogChannel'), flags: ['Ephemeral'] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(locale.get('forms.newAppTitle'))
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            interaction.fields.fields.forEach((field, key) => {
                embed.addFields({ name: field.customId.replace('question_', 'س '), value: field.value || 'لا يوجد' });
            });

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const acceptBtn = locale.getButton('buttons.formAccept');
            const rejectBtn = locale.getButton('buttons.formReject');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`form_accept_${interaction.user.id}`).setLabel(acceptBtn.label).setEmoji(acceptBtn.emoji).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`form_reject_${interaction.user.id}`).setLabel(rejectBtn.label).setEmoji(rejectBtn.emoji).setStyle(ButtonStyle.Danger)
            );

            await logCh.send({ content: `تقديم جديد من ${interaction.user}`, embeds: [embed], components: [row] });
            return interaction.reply({ content: locale.get('forms.successSubmit'), flags: ['Ephemeral'] });
        }

        if (interaction.customId === 'bc_modal') {
            const message = interaction.fields.getTextInputValue('bc_message');
            const bcKey = `${interaction.guildId}:${interaction.user.id}`;

            if (!global.bcCache) global.bcCache = new Map();
            global.bcCache.set(bcKey, message);

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bc_send_online').setLabel(locale.get('broadcast.btnOnline')).setEmoji('1519212246876557413').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('bc_send_offline').setLabel(locale.get('broadcast.btnOffline')).setEmoji('1519212245559672914').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('bc_send_all').setLabel(locale.get('broadcast.btnAll')).setEmoji('1519212186633764995').setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({
                content: locale.get('broadcast.selectTarget', { message: message.substring(0, 500) + (message.length > 500 ? '...' : '') }),
                components: [row],
                flags: ['Ephemeral']
            }).catch(() => null);
        }
        if (interaction.customId === 'tv_modal_limit') {
            const limit = parseInt(interaction.fields.getTextInputValue('limit_input'));
            if (isNaN(limit) || limit < 0 || limit > 99) {
                const emojis = require('../utils/emojis.json');
                return interaction.reply({ content: `${emojis.circlex || '❌'} **يرجى كتابة رقم صحيح بين 0 و 99**`, flags: ['Ephemeral'] });
            }
            await interaction.channel.setUserLimit(limit);

            const userSettings = db.getTempVoiceUserSettings(interaction.user.id);
            const preferredName = userSettings?.preferredName || null;
            db.saveTempVoiceUserSettings(interaction.user.id, preferredName, limit);

            const emojis = require('../utils/emojis.json');
            return interaction.reply({ content: `${emojis.tv_limit || '👥'} **تم تغيير حد الغرفة إلى ${limit === 0 ? 'مفتوح' : limit}**`, flags: ['Ephemeral'] });
        }

        if (interaction.customId === 'tv_modal_rename') {
            const name = interaction.fields.getTextInputValue('rename_input');
            await interaction.channel.setName(name);

            const userSettings = db.getTempVoiceUserSettings(interaction.user.id);
            const preferredLimit = userSettings?.preferredLimit !== undefined ? userSettings.preferredLimit : 0;
            db.saveTempVoiceUserSettings(interaction.user.id, name, preferredLimit);

            const emojis = require('../utils/emojis.json');
            return interaction.reply({ content: `${emojis.tv_rename || '✏️'} **تم تغيير اسم الغرفة إلى: ${name}**`, flags: ['Ephemeral'] });
        }
    }

    if (interaction.isUserSelectMenu()) {
        if (interaction.customId === 'tv_select_kick') {
            const targetId = interaction.values[0];
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const emojis = require('../utils/emojis.json');
            if (!member || !member.voice.channel || member.voice.channelId !== interaction.channelId) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **العضو ليس موجوداً في غرفتك الصوتية**`, components: [] });
            }
            if (targetId === interaction.user.id) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **لا يمكنك طرد نفسك**`, components: [] });
            }

            try {
                await member.voice.disconnect();
                return interaction.update({ content: `${emojis.tv_kick || '👢'} **تم طرد ${member} من الغرفة**`, components: [] });
            } catch (error) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **حدث خطأ أثناء طرد العضو**`, components: [] });
            }
        }

        if (interaction.customId === 'tv_select_trust') {
            const targetId = interaction.values[0];
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const emojis = require('../utils/emojis.json');
            if (!member) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **العضو غير موجود**`, components: [] });
            }
            if (targetId === interaction.user.id) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **لا يمكنك تعيين نفسك كمساعد**`, components: [] });
            }

            const isAlreadyTrusted = db.isTempVoiceTrusted(interaction.channelId, targetId);
            
            if (isAlreadyTrusted) {
                db.removeTempVoiceTrusted(interaction.channelId, targetId);
                await interaction.channel.permissionOverwrites.delete(targetId).catch(() => null);
                return interaction.update({ content: `${emojis.tv_trust || '👑'} **تم سحب صلاحيات المسؤول المساعد من ${member}**`, components: [] });
            } else {
                db.addTempVoiceTrusted(interaction.channelId, targetId);
                await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: true, Connect: true }).catch(() => null);
                return interaction.update({ content: `${emojis.tv_trust || '👑'} **تم تعيين ${member} كمسؤول مساعد في الغرفة**`, components: [] });
            }
        }

        if (interaction.customId === 'tv_select_ban') {
            const targetId = interaction.values[0];
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const emojis = require('../utils/emojis.json');
            if (!member) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **العضو غير موجود**`, components: [] });
            }
            if (targetId === interaction.user.id) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **لا يمكنك حظر نفسك**`, components: [] });
            }

            const isAlreadyBanned = db.isTempVoiceBanned(interaction.channelId, targetId);

            if (isAlreadyBanned) {
                db.removeTempVoiceBan(interaction.channelId, targetId);
                await interaction.channel.permissionOverwrites.delete(targetId).catch(() => null);
                return interaction.update({ content: `${emojis.tv_ban || '🚫'} **تم إلغاء حظر ${member} من دخول الغرفة**`, components: [] });
            } else {
                db.addTempVoiceBan(interaction.channelId, targetId);
                await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: false, Connect: false }).catch(() => null);
                
                if (member.voice.channelId === interaction.channelId) {
                    await member.voice.disconnect().catch(() => null);
                }

                return interaction.update({ content: `${emojis.tv_ban || '🚫'} **تم حظر ${member} من دخول الغرفة**`, components: [] });
            }
        }
    }
  }
};
