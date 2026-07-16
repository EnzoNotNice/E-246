const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const locale = require('../utils/locale');
const db = require('../database/db');
const { error } = require('../utils/embeds');
const discordTranscripts = require("discord-html-transcripts")

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    const client = interaction.client;



    // Handle Slash Commands
    /*1*/
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

    //-----------------------------//
    //Reaction Roles 
    /*2*/

    

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
        //-----------------------------//
        // Help Menu
        /*3*/


        if (interaction.customId === 'help_menu') {
            const category = interaction.values[0].replace('help_', '');

            let commandList = [];
            for (const [, cmd] of interaction.client.commands) {
                if (cmd.data && cmd.category === category) {
                    commandList.push(`**/${cmd.data.name}** ${cmd.data.description || 'بدون وصف'}`);
                }
            }

            const emojis = {
                admin: '{emoji:crown}',
                public: '{emoji:infocircle}',
                giveaway: '{emoji:confetti}',
                ticket: '{emoji:ticket}',
                protection: '{emoji:shield}',
                levels: '{emoji:chartpie}',
                automation: '{emoji:settings}',
                invite: '{emoji:mail}',
                greet: '{emoji:folder}',
                economy: '{emoji:gift}',
                games: '{emoji:playerplay}',
                utils: '{emoji:adjustments}',
                music: '{emoji:music_play}'
            };

            const arNames = {
                admin: 'الإدارة',
                public: 'العامة',
                giveaway: 'الجيف أواي',
                ticket: 'التذاكر',
                protection: 'الحماية',
                levels: 'المستويات',
                automation: 'الردود التلقائية والخطوط',
                invite: 'الدعوات',
                greet: 'الترحيب',
                economy: 'الاقتصاد',
                games: 'الألعاب والتسلية',
                utils: 'الأدوات',
                music: 'الموسيقى'
            };

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setTitle(`${emojis[category] || '{emoji:folder}'} أوامر ${arNames[category] || category}`)
                .setDescription(commandList.length > 0 ? commandList.join('\n') : 'لا توجد أوامر في هذا القسم حالياً')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.update({ embeds: [embed] }).catch(() => null);
        }
    
    //-----------------------------//
    // Handle Box
    /*4*/


    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'ticket_delete') {
          const ticket = db.getTicketByChannel(interaction.channel.id);
          if (!ticket) {
              return interaction.reply({ content: '{emoji:circlex} لم يتم العثور على بيانات التذكرة', flags: ['Ephemeral'] });
          }
          
          const settings = db.getTicketSettings(interaction.guild.id);
          const staffRole = settings.staff_role;
          const hasBypass = interaction.member.permissions.has('Administrator') || 
                            (staffRole && interaction.member.roles.cache.has(staffRole));

          if (!hasBypass) {
              return interaction.reply({ content: '{emoji:circlex} هذا الإجراء مخصص لطاقم الدعم والإدارة فقط.', flags: ['Ephemeral'] });
          }

          await interaction.reply({ content: '{emoji:trash} سيتم حذف التذكرة نهائياً خلال 5 ثواني...' });
          
          setTimeout(async () => {
              await interaction.channel.delete().catch(() => null);
          }, 5000);
          
          await logTicket(
              interaction.guild,
              settings,
              "{emoji:trash} Ticket Deleted",
              `التذكرة: ${interaction.channel.name}\nحذفت بواسطة: ${interaction.user}`,
              "#ef4444"
          );
          return;
      }

      if (id === 'ticket_reopen') {
          const ticket = db.getTicketByChannel(interaction.channel.id);
          if (!ticket) {
              return interaction.reply({ content: '{emoji:circlex} لم يتم العثور على بيانات التذكرة', flags: ['Ephemeral'] });
          }
          
          const settings = db.getTicketSettings(interaction.guild.id);
          const staffRole = settings.staff_role;
          const hasBypass = interaction.member.permissions.has('Administrator') || 
                            (staffRole && interaction.member.roles.cache.has(staffRole));

          if (!hasBypass) {
              return interaction.reply({ content: '{emoji:circlex} هذا الإجراء مخصص لطاقم الدعم والإدارة فقط.', flags: ['Ephemeral'] });
          }

          db.updateTicketStatus(interaction.channel.id, 'open');
          await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true });

          await interaction.reply({ content: '{emoji:tv_unlock} تم إعادة فتح التذكرة بنجاح' });
          
          await logTicket(
              interaction.guild,
              settings,
              "{emoji:tv_unlock} Ticket Reopened",
              `بواسطة: ${interaction.user}`
          );
          return;
      }

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
          .setTitle('{emoji:gift} تم الاستلام')
          .setDescription(`${interaction.user} استلم صندوق الغموض\n**الجائزة** ${prize}`)
          .setTimestamp();

        await interaction.update({ embeds: [winEmbed], components: [disabledRow] });
        return;
      }

      //-----------------------------//
      // Reaction Roles
      /*5*/

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

      //-----------------------------//
      // Forms Button
      /*6*/


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

      //-----------------------------//
      // Forms Accepting
      /*7*/


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

      //-----------------------------//
      // Broadcast
      /*8*/

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

        const botSettings = db.getBotSettings();
        const helperTokens = Array.isArray(botSettings.broadcast_tokens) ? botSettings.broadcast_tokens : [];

        const { Client: HelperClient, GatewayIntentBits } = require('discord.js');
        const helperClients = [];
        for (const token of helperTokens) {
            try {
                const helper = new HelperClient({ intents: [GatewayIntentBits.Guilds] });
                await helper.login(token);
                helperClients.push(helper);
            } catch (err) {
                // Ignore invalid tokens
            }
        }

        const activeBots = [interaction.client, ...helperClients];
        const membersArray = Array.from(members.values());
        const chunks = Array.from({ length: activeBots.length }, () => []);
        membersArray.forEach((member, index) => {
            chunks[index % activeBots.length].push(member);
        });

        let sent = 0;
        let failed = 0;

        await Promise.all(activeBots.map(async (bot, botIndex) => {
            const myMembers = chunks[botIndex];
            for (const member of myMembers) {
                try {
                    await new Promise(r => setTimeout(r, 1500));
                    if (bot.user.id === interaction.client.user.id) {
                        await member.send({ content: `${messageContent}\n\n${member}` });
                    } else {
                        const user = await bot.users.fetch(member.id).catch(() => null);
                        if (user) {
                            await user.send({ content: `${messageContent}\n\n${member}` });
                        } else {
                            throw new Error('User not fetchable');
                        }
                    }
                    sent++;
                } catch (e) {
                    failed++;
                }
            }
        }));

        for (const helper of helperClients) {
            try {
                await helper.destroy();
            } catch (err) {}
        }

        global.bcCache.delete(bcKey);

        return interaction.followUp({ content: locale.get('broadcast.completed', { sent, failed }) }).catch(() => null);
      }

      //-----------------------------//
      // Verify
      /*9*/

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

      //-----------------------------//
      // Verify answer
      /*9*/

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

      
      //----------------------------//
      // Temp Voice Buttons
      /*10*/

      if (id.startsWith('tv_')) {
        let channel = interaction.channel;
        let channelId = interaction.channelId;

        if (channel.type !== ChannelType.GuildVoice) {
          const voiceChannel = interaction.member.voice.channel;
          if (!voiceChannel) {
            const emojis = require('../utils/emojis.json');
            return interaction.reply({ content: `${emojis.circlex || '❌'} **يجب أن تكون في غرفتك الصوتية لتتمكن من التحكم بها**`, flags: ['Ephemeral'] });
          }
          channel = voiceChannel;
          channelId = voiceChannel.id;
        }

        const tvChannel = db.getTempVoiceChannel(channelId);
        if (!tvChannel) {
          const emojis = require('../utils/emojis.json');
          return interaction.reply({ content: `${emojis.circlex || '❌'} **هذه ليست غرفة مؤقتة صالحة**`, flags: ['Ephemeral'] });
        }

        const isOwner = tvChannel.ownerId === interaction.user.id;
        const isTrusted = db.isTempVoiceTrusted(channelId, interaction.user.id);

        const emojis = require('../utils/emojis.json');

        if (!isOwner && !isTrusted) {
          return interaction.reply({ content: `${emojis.circlex || '❌'} **لا تملك صلاحية التحكم بهذه الغرفة**`, flags: ['Ephemeral'] });
        }

        if ((id === 'tv_trust' || id === 'tv_ban') && !isOwner) {
          return interaction.reply({ content: `${emojis.circlex || '❌'} **هذه الصلاحية لمالك الغرفة الأساسي فقط**`, flags: ['Ephemeral'] });
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
          const modal = new ModalBuilder().setCustomId(`tv_modal_limit_${channelId}`).setTitle('تحديد عدد الأشخاص');
          const input = new TextInputBuilder().setCustomId('limit_input').setLabel('العدد (0 مفتوح، الحد الأقصى 99)').setStyle(TextInputStyle.Short).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        if (id === 'tv_rename') {
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`tv_modal_rename_${channelId}`).setTitle('تغيير اسم الغرفة');
          const input = new TextInputBuilder().setCustomId('rename_input').setLabel('الاسم الجديد').setStyle(TextInputStyle.Short).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        if (id === 'tv_kick') {
          const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
            .setCustomId(`tv_select_kick_${channelId}`)
            .setPlaceholder('اختر الشخص لطرده من الروم')
            .setMaxValues(1);
          
          return interaction.reply({ content: `${emojis.tv_kick || '👢'} **اختر الشخص لطرده من الروم**`, components: [new ActionRowBuilder().addComponents(select)], flags: ['Ephemeral'] });
        }

        if (id === 'tv_trust') {
          const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
            .setCustomId(`tv_select_trust_${channelId}`)
            .setPlaceholder('اختر الشخص لإضافته أو إزالته كمسؤول مساعد')
            .setMaxValues(1);
          
          return interaction.reply({ content: `${emojis.tv_trust || '👑'} **اختر شخصاً لإعطائه أو سحب صلاحيات المساعد منه في غرفتك الصوتية**`, components: [new ActionRowBuilder().addComponents(select)], flags: ['Ephemeral'] });
        }

        if (id === 'tv_ban') {
          const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
            .setCustomId(`tv_select_ban_${channelId}`)
            .setPlaceholder('اختر الشخص لحظره أو إلغاء حظره')
            .setMaxValues(1);
          
          return interaction.reply({ content: `${emojis.tv_ban || '🚫'} **اختر شخصاً لحظر أو إلغاء حظر دخوله لغرفتك الصوتية**`, components: [new ActionRowBuilder().addComponents(select)], flags: ['Ephemeral'] });
        }
      }
    }

    //-----------------------------//
    // Handle Modals
    /*11*/

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

        //-----------------------------//
        // Forms Modal
        /*12*/

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
        //-----------------------------//
        // Voice Channel Modal
        /*13*/
        if (interaction.customId.startsWith('tv_modal_limit_')) {
            const channelId = interaction.customId.split('_').pop();
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) return interaction.reply({ content: 'الغرفة الصوتية غير موجودة', flags: ['Ephemeral'] });

            const limit = parseInt(interaction.fields.getTextInputValue('limit_input'));
            if (isNaN(limit) || limit < 0 || limit > 99) {
                const emojis = require('../utils/emojis.json');
                return interaction.reply({ content: `${emojis.circlex || '❌'} **يرجى كتابة رقم صحيح بين 0 و 99**`, flags: ['Ephemeral'] });
            }
            await targetChannel.setUserLimit(limit);

            const userSettings = db.getTempVoiceUserSettings(interaction.user.id);
            const preferredName = userSettings?.preferredName || null;
            db.saveTempVoiceUserSettings(interaction.user.id, preferredName, limit);

            const emojis = require('../utils/emojis.json');
            return interaction.reply({ content: `${emojis.tv_limit || '👥'} **تم تغيير حد الغرفة إلى ${limit === 0 ? 'مفتوح' : limit}**`, flags: ['Ephemeral'] });
        }

        if (interaction.customId.startsWith('tv_modal_rename_')) {
            const channelId = interaction.customId.split('_').pop();
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) return interaction.reply({ content: 'الغرفة الصوتية غير موجودة', flags: ['Ephemeral'] });

            const name = interaction.fields.getTextInputValue('rename_input');
            await targetChannel.setName(name);

            const userSettings = db.getTempVoiceUserSettings(interaction.user.id);
            const preferredLimit = userSettings?.preferredLimit !== undefined ? userSettings.preferredLimit : 0;
            db.saveTempVoiceUserSettings(interaction.user.id, name, preferredLimit);

            const emojis = require('../utils/emojis.json');
            return interaction.reply({ content: `${emojis.tv_rename || '✏️'} **تم تغيير اسم الغرفة إلى: ${name}**`, flags: ['Ephemeral'] });
        }
    }

    if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) {
        if (interaction.customId.startsWith('tv_select_kick_')) {
            const channelId = interaction.customId.split('_').pop();
            const targetId = interaction.values[0];
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const emojis = require('../utils/emojis.json');
            if (!member || !member.voice.channel || member.voice.channelId !== channelId) {
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

        if (interaction.customId.startsWith('tv_select_trust_')) {
            const channelId = interaction.customId.split('_').pop();
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) return interaction.update({ content: 'الغرفة الصوتية غير موجودة', components: [] });

            const targetId = interaction.values[0];
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const emojis = require('../utils/emojis.json');
            if (!member) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **العضو غير موجود**`, components: [] });
            }
            if (targetId === interaction.user.id) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **لا يمكنك تعيين نفسك كمساعد**`, components: [] });
            }

            const isAlreadyTrusted = db.isTempVoiceTrusted(channelId, targetId);
            
            if (isAlreadyTrusted) {
                db.removeTempVoiceTrusted(channelId, targetId);
                await targetChannel.permissionOverwrites.delete(targetId).catch(() => null);
                return interaction.update({ content: `${emojis.tv_trust || '👑'} **تم سحب صلاحيات المسؤول المساعد من ${member}**`, components: [] });
            } else {
                db.addTempVoiceTrusted(channelId, targetId);
                await targetChannel.permissionOverwrites.edit(targetId, { ViewChannel: true, Connect: true }).catch(() => null);
                return interaction.update({ content: `${emojis.tv_trust || '👑'} **تم تعيين ${member} كمسؤول مساعد في الغرفة**`, components: [] });
            }
        }

        if (interaction.customId.startsWith('tv_select_ban_')) {
            const channelId = interaction.customId.split('_').pop();
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) return interaction.update({ content: 'الغرفة الصوتية غير موجودة', components: [] });

            const targetId = interaction.values[0];
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            const emojis = require('../utils/emojis.json');
            if (!member) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **العضو غير موجود**`, components: [] });
            }
            if (targetId === interaction.user.id) {
                return interaction.update({ content: `${emojis.circlex || '❌'} **لا يمكنك حظر نفسك**`, components: [] });
            }

            const isAlreadyBanned = db.isTempVoiceBanned(channelId, targetId);

            if (isAlreadyBanned) {
                db.removeTempVoiceBan(channelId, targetId);
                await targetChannel.permissionOverwrites.delete(targetId).catch(() => null);
                return interaction.update({ content: `${emojis.tv_ban || '🚫'} **تم إلغاء حظر ${member} من دخول الغرفة**`, components: [] });
            } else {
                db.addTempVoiceBan(channelId, targetId);
                await targetChannel.permissionOverwrites.edit(targetId, { ViewChannel: false, Connect: false }).catch(() => null);
                
                if (member.voice.channelId === channelId) {
                    await member.voice.disconnect().catch(() => null);
                }

                return interaction.update({ content: `${emojis.tv_ban || '🚫'} **تم حظر ${member} من دخول الغرفة**`, components: [] });
            }
        }
    }


     //-------------------------------//
    // NEW TICKET SYSTEN COMMIT OMAR // 
   //-------------------------------//


   const logTicket = require("../utils/ticketlogger");


   function getTicket(interaction) {

    const ticket = db.getTicketByChannel(
        interaction.channel.id
    );

    if (!ticket) return null;

    return ticket;
}

async function replyError(interaction, msg) {

    return interaction.reply({
        content: `❌ ${msg}`,
        ephemeral: true
    });

}



const {
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder
} = require("discord.js");

if (
    !interaction.isButton() &&
    !interaction.isStringSelectMenu() &&
    !interaction.isModalSubmit()
) return;

if (
    interaction.isButton() &&
    interaction.customId === "ticket_create_btn"
) {

    const settings = await db.getTicketSettings(
        interaction.guild.id
    );

    const panelData = settings.panel_data || {};

    const existing = interaction.guild.channels.cache.find(c =>
    c.topic === `ticket:${interaction.user.id}`
);

const blocked =
    db.isTicketBlacklisted(
        interaction.guild.id,
        interaction.user.id
    );

if (blocked) {

    return interaction.reply({
        content:
            "{emoji:circlex} أنت ممنوع من فتح التذاكر في هذا السيرفر",
        ephemeral: true
    });

}

if (existing) {
    return interaction.reply({
        content: `{emoji:circlex} لديك تذكرة مفتوحة بالفعل: ${existing}`,
        ephemeral: true
    });
}

const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,

    parent: settings.category_id || null,

    topic: `ticket:${interaction.user.id}`,

    permissionOverwrites: [
        {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
        },

        {
            id: interaction.user.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
            ]
        },

        ...(settings.staff_role ? [{
            id: settings.staff_role,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages
            ]
        }] : [])
    ]
});

await db.createTicket(
    interaction.guild.id,
    interaction.user.id,
    channel.id,
    "general"
);

const buttons = [

new ButtonBuilder()
.setCustomId("claim_ticket")
.setLabel("استلام التذكرة")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("إغلاق التذكرة")
.setStyle(ButtonStyle.Danger)

];

const menuOptions = [

{
label: "إضافة عضو",
value: "add_member"
},

{
label: "إزالة عضو",
value: "remove_member"
}

];

const actionLabels = {

call_user: "Call User",
call_support: "Call Support",
call_owners: "Call Owners",
warn_user: "Warn User",
blacklist_user: "Blacklist User",
rename_ticket: "Rename Ticket",
lock_ticket: "Lock Ticket",
unlock_ticket: "Unlock Ticket"

};

if (
    panelData.panel_mode === "advanced" &&
    panelData.actions
) {

    for (const [action, mode] of Object.entries(panelData.actions || {})) {

        if (mode === "button") {

            buttons.push(
                new ButtonBuilder()
                    .setCustomId(action)
                    .setLabel(actionLabels[action] || action)
                    .setStyle(ButtonStyle.Secondary)
            );

        }

        if (mode === "menu") {

            menuOptions.push({
                label: actionLabels[action] || action,
                value: action
            });

        }

    }

}

for (const btn of panelData.custom_buttons || []) {

    if (!btn.label?.trim()) continue;

    buttons.push(
        new ButtonBuilder()
        .setCustomId(`custom_btn_${buttons.length}`)
        .setLabel(btn.label)
        .setEmoji(btn.emoji || null)
        .setStyle(
            ButtonStyle[btn.style] ||
            ButtonStyle.Primary
        )
    );

}

const rows = [];

for (let i = 0; i < buttons.length; i += 5) {

    rows.push(
        new ActionRowBuilder()
        .addComponents(
            buttons.slice(i, i + 5)
        )
    );

}

rows.push(
    new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
        .setCustomId("ticket_control_menu")
        .setPlaceholder("لوحة التحكم")
        .addOptions(menuOptions)
    )
);

for (const menu of panelData.custom_menus || []) {

    if (!menu.options?.length) continue;

    rows.push(
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`custom_menu_${rows.length}`)
                .setPlaceholder(
                    menu.placeholder || "اختر"
                )
                .addOptions(
                    menu.options.map((o, i) => ({
                        label: o.label || `Option ${i + 1}`,
                        value: `custom_option_${i}`,
                        description: o.description || undefined,
                        emoji: o.emoji || undefined
                    }))
                )
        )
    );
}

for (const menu of panelData.custom_menus || []) {

    if (!menu.options?.length) continue;

    rows.push(
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`custom_menu_${rows.length}`)
                .setPlaceholder(
                    menu.placeholder || "اختر"
                )
                .addOptions(
                    menu.options.map((o, i) => ({
                        label: o.label || `Option ${i + 1}`,
                        value: `custom_option_${i}`,
                        description: o.description || undefined,
                        emoji: o.emoji || undefined
                    }))
                )
        )
    );
}



const ticketStyle = panelData.ticket_message_style || {};

if(ticketStyle.type === "embed") {

    const Description1 = (ticketStyle.embed?.description || "")
    .replaceAll("{user}", `<@${interaction.user.id}>`)
.replaceAll("{user_tag}", interaction.user.tag)
.replaceAll("{server}", interaction.guild.name)
.replaceAll("{ticket}", channel.name);

    const embed = new EmbedBuilder()
        .setColor(ticketStyle.embed?.color || "#5865F2")
        .setTitle(ticketStyle.embed?.title || "تذكرة جديدة")
        .setDescription(Description1);
        

    if(ticketStyle.embed?.thumbnail)
        embed.setThumbnail(ticketStyle.embed.thumbnail);

    if(ticketStyle.embed?.image)
        embed.setImage(ticketStyle.embed.image);

    if(ticketStyle.embed?.footer)
        embed.setFooter({
            text: ticketStyle.embed.footer,
            iconURL: ticketStyle.embed.footer_icon || null
        });

    await channel.send({
        content: `<@${interaction.user.id}> - <@&${settings.staff_role}>`,
        embeds: [embed],
        components: rows
    
    });

    
}


else if(ticketStyle.type === "plain") {

    const content =
        (ticketStyle.plain?.content || settings.ticket_message)
            .replaceAll("{user}", `<@${interaction.user.id}>`)
.replaceAll("{user_tag}", interaction.user.tag)
.replaceAll("{server}", interaction.guild.name)
.replaceAll("{ticket}", channel.name);

    await channel.send({
        content,
        components: rows
    });
}

else if(ticketStyle.type === "container") {

    const Description = (ticketStyle.container?.description || "")
    .replaceAll("{user}", `<@${interaction.user.id}>`)
.replaceAll("{user_tag}", interaction.user.tag)
.replaceAll("{server}", interaction.guild.name)
.replaceAll("{ticket}", channel.name);


    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(ticketStyle.container?.title || "Container")
        .setDescription(Description);
        

    await channel.send({
        content: `<@${interaction.user.id}> - <@&${settings.staff_role}>`,
        embeds: [embed],
        components: rows
    });

    


}



await interaction.reply({

content: `{emoji:circlecheck} تم إنشاء التذكرة ${channel}`,

ephemeral: true

});

await logTicket(
    interaction.guild,
    settings,
    "{emoji:folderopen} Ticket Opened",
    `المستخدم: ${interaction.user}
القناة: ${channel}`
);

}

if (interaction.customId === "claim_ticket") {

    const ticket = db.getTicketByChannel(interaction.channel.id);

    if (!ticket)
        return interaction.reply({
            content: "{emoji:circlex} لم يتم العثور على بيانات التذكرة",
            ephemeral: true
        });

    const settings = db.getTicketSettings(interaction.guild.id);
    const staffRole = settings.staff_role;
    const hasBypass = interaction.member.permissions.has('Administrator') || 
                      (staffRole && interaction.member.roles.cache.has(staffRole));

    if (!hasBypass) {
        return interaction.reply({
            content: "{emoji:circlex} هذا الزر مخصص لطاقم الإدارة والدعم فقط.",
            ephemeral: true
        });
    }

    if (ticket.claimedBy)
        return interaction.reply({
            content: `{emoji:circlex} التذكرة مستلمة بالفعل بواسطة <@${ticket.claimedBy}>`,
            ephemeral: true
        });

    db.claimTicket(
        interaction.channel.id,
        interaction.user.id
    );

    await interaction.reply({
        content: `{emoji:circlecheck} تم استلام التذكرة بواسطة ${interaction.user}`,
        ephemeral: false
    });




    await logTicket(
    interaction.guild,
    settings,
    "{emoji:bell} Ticket Claimed",
    `الموظف: ${interaction.user}
القناة: ${interaction.channel}`
);


}

if (interaction.customId === "close_ticket") {

    const ticket = db.getTicketByChannel(interaction.channel.id);

    if (!ticket)
        return interaction.reply({
            content: "{emoji:circlex} لم يتم العثور على التذكرة",
            ephemeral: true
        });

    await interaction.reply({
        content: "{emoji:lock} سيتم إغلاق التذكرة خلال 5 ثواني..."
    });

    const settings = await db.getTicketSettings(
        interaction.guild.id
    );

    await logTicket(
    interaction.guild,
    settings,
    "{emoji:circlex} Ticket Closed",
    `بواسطة: ${interaction.user}`,
    "#ef4444"
);

const attachment =
await discordTranscripts.createTranscript(
    interaction.channel,
    {
        limit: -1,
        returnType: "attachment",
        filename: `${interaction.channel.name}.html`
    }
);

const ticketOwner =
await interaction.client.users
.fetch(ticket.userId)
.catch(() => null);

if (ticketOwner) {

    const row =
    new ActionRowBuilder()
    .addComponents(

        new ButtonBuilder()
        .setCustomId(
            `rate_ticket_${interaction.guild.id}_${ticket.channelId}`
        )
        .setLabel("⭐ تقييم الإدارة")
        .setStyle(ButtonStyle.Primary)

    );

    await ticketOwner.send({

        content:
        "{emoji:star} تم إغلاق تذكرتك، نرجو تقييم فريق الإدارة.",

        components: [row]

    }).catch(() => null);

}

const channelId = interaction.channel.id;

setTimeout(async () => {

    const channel =
        interaction.guild.channels.cache.get(
            channelId
        );

    if (!channel) return;

    await channel.delete().catch(() => null);

}, 5000);



    db.updateTicketStatus(
        interaction.channel.id,
        "closed"
    );

    
}


let action = null;

if (interaction.isButton()) {
    action = interaction.customId;
}

if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "ticket_control_menu"
) {
    action = interaction.values[0];
}

const ticket = db.getTicketByChannel(interaction.channel.id);

const ticketActions = ["lock_ticket", "unlock_ticket", "rename_ticket", "add_member", "remove_member", "blacklist_user", "warn_user"];
if (action && ticketActions.includes(action)) {
    const settings = db.getTicketSettings(interaction.guild.id);
    const staffRole = settings.staff_role;
    const hasBypass = interaction.member.permissions.has('Administrator') || 
                      (staffRole && interaction.member.roles.cache.has(staffRole));

    if (!hasBypass) {
        return interaction.reply({
            content: "{emoji:circlex} هذا الإجراء مخصص لطاقم الإدارة والدعم فقط.",
            ephemeral: true
        });
    }
}

if (action === "lock_ticket") {

    await interaction.channel.permissionOverwrites.edit(
        ticket.userId,
        {
            SendMessages: false
        }
    );

    return interaction.reply({
        content: "{emoji:lock} تم قفل التذكرة",
        ephemeral: false
    });
}

if (action === "unlock_ticket") {

    await interaction.channel.permissionOverwrites.edit(
        ticket.userId,
        {
            SendMessages: true
        }
    );

    return interaction.reply({
        content: "{emoji:tv_unlock} تم فتح التذكرة",
        ephemeral: false
    });
}


if (action === "rename_ticket") {

    const modal = new ModalBuilder()
        .setCustomId("rename_ticket_modal")
        .setTitle("تغيير اسم التذكرة");

    const nameInput = new TextInputBuilder()
        .setCustomId("new_ticket_name")
        .setLabel("الاسم الجديد")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput)
    );

    return interaction.showModal(modal);
}

if (interaction.isModalSubmit()) {

    if (interaction.customId === "rename_ticket_modal") {

        const newName = interaction.fields
            .getTextInputValue("new_ticket_name")
            .trim();

        await interaction.channel.setName(newName);

        const settings = await db.getTicketSettings(
            interaction.guild.id
        );
        await logTicket(
            interaction.guild,
            settings,
            "{emoji:tv_rename} Ticket Renamed",
            `الاسم الجديد: ${newName}`
        );

        return interaction.reply({
            content: `{emoji:tv_rename} تم تغيير اسم التذكرة إلى \`${newName}\``,
            ephemeral: false
        });


    }

}

if (action === "add_member") {

    const modal = new ModalBuilder()
        .setCustomId("add_member_modal")
        .setTitle("إضافة عضو");

    const input = new TextInputBuilder()
        .setCustomId("member_id")
        .setLabel("ID أو Mention العضو")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return interaction.showModal(modal);
}

if (action === "remove_member") {

    const modal = new ModalBuilder()
        .setCustomId("remove_member_modal")
        .setTitle("إزالة عضو");

    const input = new TextInputBuilder()
        .setCustomId("member_id")
        .setLabel("ID أو Mention العضو")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return interaction.showModal(modal);
}

if (interaction.customId === "add_member_modal") {

    let userId = interaction.fields
        .getTextInputValue("member_id")
        .trim();

    userId = userId.replace(/[<@!>]/g, "");

    const member = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);

    if (!member) {
        return interaction.reply({
            content: "{emoji:circlex} لم يتم العثور على العضو",
            ephemeral: true
        });
    }

    await interaction.channel.permissionOverwrites.create(
        member.id,
        {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        }
    );

    const settings = await db.getTicketSettings(
        interaction.guild.id
    );
    await logTicket(
        interaction.guild,
        settings,
        "{emoji:user} Member Added",
        `العضو: @${member.user.tag}`
    );

    return interaction.reply({
        content: `{emoji:circlecheck} تمت إضافة ${member.user.tag}`,
        ephemeral: false
    });
}

if (interaction.customId === "remove_member_modal") {

    let userId = interaction.fields
        .getTextInputValue("member_id")
        .trim();

    userId = userId.replace(/[<@!>]/g, "");

    const member = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);

    if (!member) {
        return interaction.reply({
            content: "{emoji:circlex} لم يتم العثور على العضو",
            ephemeral: true
        });
    }

    const ticket = db.getTicketByChannel(
        interaction.channel.id
    );

    if (ticket && ticket.userId === member.id) {
        return interaction.reply({
            content: "{emoji:circlex} لا يمكن إزالة صاحب التذكرة",
            ephemeral: true
        });
    }

    await interaction.channel.permissionOverwrites.delete(
        member.id
    );

    const settings = await db.getTicketSettings(
        interaction.guild.id
    );
    await logTicket(
        interaction.guild,
        settings,
        "{emoji:circlex} Member Removed",
        `العضو: @${member.user.tag}`,
        "#ff9900"
    );

    return interaction.reply({
        content: `{emoji:circlex} تمت إزالة ${member.user.tag}`,
        ephemeral: false
    });
}

if (
    interaction.customId === "call_user" ||
    interaction.values?.includes("call_user")
) {

    const ticket = db.getTicketByChannel(
        interaction.channel.id
    );

    if (!ticket)
        return interaction.reply({
            content: "{emoji:circlex} لم يتم العثور على صاحب التذكرة",
            ephemeral: true
        });

    const user = await interaction.client.users
        .fetch(ticket.userId)
        .catch(() => null);

    if (!user)
        return interaction.reply({
            content: "{emoji:circlex} تعذر الوصول للمستخدم",
            ephemeral: true
        });

    await user.send({
        embeds: [
            new EmbedBuilder()
            .setColor("Yellow")
            .setTitle("{emoji:clock} تم استدعاؤك")
            .setDescription(
                `يرجى التوجه إلى التذكرة:\n<#${interaction.channel.id}>`
            )
        ]
    }).catch(() => null);

    return interaction.reply({
        content: "{emoji:circlecheck} تم إرسال الاستدعاء للمستخدم",
        ephemeral: true
    });
}

if (
    interaction.customId === "call_support" ||
    interaction.values?.includes("call_support")
) {

    const settings = db.getTicketSettings(
        interaction.guild.id
    );

    const role = interaction.guild.roles.cache.get(
        settings.staff_role
    );

    if (!role)
        return interaction.reply({
            content: "{emoji:circlex} لم يتم العثور على رتبة الدعم",
            ephemeral: true
        });

    let sent = 0;

    for (const member of role.members.values()) {

        await member.send({
            embeds: [
                new EmbedBuilder()
                .setColor("Blue")
                .setTitle("{emoji:clock} استدعاء دعم")
                .setDescription(
                    `تم طلب الدعم داخل:\n<#${interaction.channel.id}>`
                )
            ]
        }).catch(() => null);

        sent++;
    }

    return interaction.reply({
        content: `{emoji:circlecheck} تم استدعاء ${sent} من طاقم الدعم`,
        ephemeral: true
    });
}

if (
    interaction.customId === "call_owners" ||
    interaction.values?.includes("call_owners")
) {

    const settings = db.getTicketSettings(
        interaction.guild.id
    );

    const role = interaction.guild.roles.cache.get(
        settings.owners_role
    );

    if (!role)
        return interaction.reply({
            content: "{emoji:circlex} لم يتم العثور على رتبة الإدارة",
            ephemeral: true
        });

    let sent = 0;

    for (const member of role.members.values()) {

        await member.send({
            embeds: [
                new EmbedBuilder()
                .setColor("Red")
                .setTitle("{emoji:alerttriangle} استدعاء إدارة")
                .setDescription(
                    `تم طلب الإدارة داخل:\n<#${interaction.channel.id}>`
                )
            ]
        }).catch(() => null);

        sent++;
    }

    return interaction.reply({
        content: `{emoji:circlecheck} تم استدعاء ${sent} من الإدارة`,
        ephemeral: true
    });
}


if (action === "blacklist_user") {

    const modal = new ModalBuilder()
        .setCustomId("blacklist_user_modal")
        .setTitle("حظر مستخدم من التذاكر");

    const input = new TextInputBuilder()
        .setCustomId("target_user")
        .setLabel("ID أو Mention")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(input)
    );

    return interaction.showModal(modal);
}

if (
    interaction.customId ===
    "blacklist_user_modal"
) {

    let userId = interaction.fields
        .getTextInputValue("target_user")
        .trim();

    userId = userId.replace(
        /[<@!>]/g,
        ""
    );

    const user =
        await interaction.client.users
        .fetch(userId)
        .catch(() => null);

    if (!user) {

        return interaction.reply({
            content:
                "{emoji:circlex} المستخدم غير موجود",
            ephemeral: true
        });

    }

    db.addTicketBlacklist(
        interaction.guild.id,
        user.id
    );

    await interaction.reply({
        content:
            `{emoji:circlex} تم حظر ${user.tag} من فتح التذاكر`,
        ephemeral: false
    });

}

   if (action === "warn_user") {

    const modal = new ModalBuilder()
        .setCustomId("warn_user_modal")
        .setTitle("تحذير مستخدم");

    const userInput = new TextInputBuilder()
        .setCustomId("target_user")
        .setLabel("ID أو Mention")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const reasonInput = new TextInputBuilder()
        .setCustomId("warn_reason")
        .setLabel("سبب التحذير")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(reasonInput)
    );

    return interaction.showModal(modal);
}

if (interaction.customId === "warn_user_modal") {

    let userId = interaction.fields
        .getTextInputValue("target_user")
        .trim();

    const reason = interaction.fields
        .getTextInputValue("warn_reason");

    userId = userId.replace(/[<@!>]/g, "");

    const user = await interaction.client.users
        .fetch(userId)
        .catch(() => null);

    if (!user) {
        return interaction.reply({
            content: "{emoji:circlex} المستخدم غير موجود",
            ephemeral: true
        });
    }

    db.addTicketWarning(
        interaction.guild.id,
        user.id,
        interaction.user.id,
        reason
    );

    const warnings = db.getTicketWarnings(
        interaction.guild.id,
        user.id
    );

    await user.send({
        embeds: [
            new EmbedBuilder()
                .setColor("Orange")
                .setTitle("{emoji:alerttriangle} تحذير")
                .setDescription(
                    `لقد تلقيت تحذيراً في ${interaction.guild.name}\n\nالسبب:\n${reason}`
                )
        ]
    }).catch(() => null);

    await interaction.reply({
        content:
            `{emoji:alerttriangle} تم تحذير ${user.tag}\nعدد التحذيرات: ${warnings.length}`,
        ephemeral: false
    });

    const settings = await db.getTicketSettings(
        interaction.guild.id
    );
await logTicket(
    interaction.guild,
    settings,
    "{emoji:alerttriangle} User Warned",
    `المستخدم: @${user.tag}
السبب: ${reason}`,
    "#f59e0b"
);

}


if (
    interaction.isButton() &&
    interaction.customId.startsWith("rate_ticket_")
) {

    const {
        ModalBuilder,
        TextInputBuilder,
        TextInputStyle,
        ActionRowBuilder
    } = require("discord.js");

    const modal = new ModalBuilder()
        .setCustomId(interaction.customId)
        .setTitle("تقييم الإدارة");

    const stars = new TextInputBuilder()
        .setCustomId("stars")
        .setLabel("عدد النجوم (1-5)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const staffIdInput = new TextInputBuilder()
        .setCustomId("staff_id")
        .setLabel("معرف الإداري (ID)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const comment = new TextInputBuilder()
        .setCustomId("comment")
        .setLabel("رأيك")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(stars),
        new ActionRowBuilder().addComponents(staffIdInput),
        new ActionRowBuilder().addComponents(comment)
    );

    await interaction.showModal(modal);
}

if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith("rate_ticket_")
) {

    const parts = interaction.customId.split("_");
    const guildId = parts[2];

    const stars = interaction.fields.getTextInputValue("stars");
    const staffId = interaction.fields.getTextInputValue("staff_id").trim();
    const comment = interaction.fields.getTextInputValue("comment") || "لا يوجد تعليق";

    const numStars = Number(stars);
    if (isNaN(numStars) || numStars < 1 || numStars > 5) {
        return interaction.reply({
            content: "❌ يجب أن يكون التقييم رقماً بين 1 و 5",
            ephemeral: true
        });
    }

    const guild = interaction.client.guilds.cache.get(guildId);
    if (!guild) {
        return interaction.reply({
            content: "❌ تعذر العثور على السيرفر",
            ephemeral: true
        });
    }

    const settings = db.getTicketSettings(guildId);
    const feedbackChannel = guild.channels.cache.get(settings.feedbacks_channel);

    if (!feedbackChannel) {
        return interaction.reply({
            content: "❌ روم التقييمات غير موجود",
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor("#f59e0b")
        .setTitle("⭐ تقييم جديد")
        .addFields(
            {
                name: "العضو",
                value: `${interaction.user} (${interaction.user.id})`,
                inline: true
            },
            {
                name: "الإداري",
                value: `<@${staffId}> (${staffId})`,
                inline: true
            },
            {
                name: "التقييم",
                value: "⭐".repeat(numStars),
                inline: true
            },
            {
                name: "التعليق",
                value: comment,
                inline: false
            }
        )
        .setTimestamp();

    await feedbackChannel.send({
        embeds: [embed]
    });

    await interaction.reply({
        content: "✅ شكراً على تقييمك",
        ephemeral: true
    });
}




  }

};
