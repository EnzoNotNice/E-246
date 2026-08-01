const {
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');
const locale = require('../utils/locale');
const db = require('../database/db');
const { error } = require('../utils/embeds');
const discordTranscripts = require('discord-html-transcripts');
const logTicket = require('../utils/ticketlogger');
const emojis = require('../utils/emojis.json');
const config = require('../config');
const { logger } = require('../utils/logger');

const cooldowns = new Map();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      const client = interaction.client;

      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Rate limiter check
        const userId = interaction.user.id;
        const isOwner = interaction.guild && userId === interaction.guild.ownerId;
        const isSelfAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!isOwner && !isSelfAdmin) {
          const now = Date.now();
          const cooldownAmount = config.cooldown.durationMs || 2500;
          const userCooldown = cooldowns.get(userId);

          if (userCooldown) {
            const expirationTime = userCooldown + cooldownAmount;
            if (now < expirationTime) {
              const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
              const clockEmoji = emojis.clock || '⏱️';
              return interaction
                .reply({
                  content: `${clockEmoji} مهلاً، يرجى الانتظار ${timeLeft} ثانية قبل استخدام أمر آخر`,
                  ephemeral: true
                })
                .catch(() => null);
            }
          }
          cooldowns.set(userId, now);
        }

        const restrictions = db.getCommandRestrictions(interaction.guildId, interaction.commandName);
        const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        if (restrictions && !isAdmin) {
          if (
            restrictions.allowedRoles &&
            Array.isArray(restrictions.allowedRoles) &&
            restrictions.allowedRoles.length > 0
          ) {
            const hasRole = interaction.member.roles.cache.some((role) => restrictions.allowedRoles.includes(role.id));
            if (!hasRole) {
              return interaction
                .reply({
                  content: '{emoji:circlex} ليس لديك الرتبة المطلوبة لاستخدام هذا الأمر.',
                  flags: ['Ephemeral']
                })
                .catch(() => null);
            }
          }
          if (
            restrictions.allowedChannels &&
            Array.isArray(restrictions.allowedChannels) &&
            restrictions.allowedChannels.length > 0
          ) {
            if (!restrictions.allowedChannels.includes(interaction.channelId)) {
              return interaction
                .reply({ content: '{emoji:circlex} هذا الأمر غير متاح في هذا الروم.', flags: ['Ephemeral'] })
                .catch(() => null);
            }
          }
        }

        try {
          await command.execute(interaction);
        } catch (e) {
          if (e.code === 10062 || e.message?.includes('Unknown interaction')) {
            logger.warn(`[Slash Command] Interaction expired or unknown for /${interaction.commandName}`);
            return;
          }
          logger.error(`Slash command error [${interaction.commandName}]:`, e);
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
        const added = [];
        const removed = [];
        const failed = [];

        const menuOptions = interaction.component?.options || [];
        const selectedValues = interaction.values || [];

        for (const opt of menuOptions) {
          if (opt.value && opt.value.startsWith('rr_opt_')) {
            const roleId = opt.value.replace('rr_opt_', '');
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) continue;

            const isSelected = selectedValues.includes(opt.value);
            const hasRole = member.roles.cache.has(roleId);

            try {
              if (isSelected && !hasRole) {
                await member.roles.add(roleId);
                added.push(role.name);
              } else if (!isSelected && hasRole) {
                await member.roles.remove(roleId);
                removed.push(role.name);
              }
            } catch (e) {
              failed.push(role.name);
            }
          }
        }

        const msgParts = [];
        if (added.length > 0) msgParts.push(`✅ تم إضافة الرتب: **${added.join(', ')}**`);
        if (removed.length > 0) msgParts.push(`🗑️ تم إزالة الرتب: **${removed.join(', ')}**`);
        if (failed.length > 0) msgParts.push(`⚠️ تعذر تحديث بعض الرتب: (${failed.join(', ')})`);
        if (msgParts.length === 0) msgParts.push('ℹ️ لم يتم إجراء أي تغيير على رتبك.');

        return interaction.editReply({ content: msgParts.join('\n') });
      }

      if (interaction.customId === 'help_menu') {
        const category = interaction.values[0].replace('help_', '');

        const emojisJson = JSON.parse(
          require('fs').readFileSync(require('path').join(__dirname, '../utils/emojis.json'), 'utf8')
        );
        const resolveEmoji = (key, fallback) => {
          const val = emojisJson[key];
          if (!val) return fallback;
          const m = val.match(/<a?:(\w+):(\d+)>/);
          if (m) return `<${m[0].startsWith('<a:') ? 'a:' : ':'}${m[1]}:${m[2]}>`;
          return val;
        };

        const listEmoji = resolveEmoji('list', '🔹');
        const commandList = [];
        for (const [, cmd] of interaction.client.commands) {
          if (cmd.data && cmd.category === category) {
            const desc = cmd.data.description || 'بدون وصف';
            commandList.push(`${listEmoji} **/${cmd.data.name}**\n- '${desc}'`);
          }
        }

        const categoryEmojis = {
          admin: resolveEmoji('crown', '👑'),
          public: resolveEmoji('infocircle', 'ℹ️'),
          giveaway: resolveEmoji('confetti', '🎉'),
          ticket: resolveEmoji('ticket', '🎫'),
          protection: resolveEmoji('shield', '🛡️'),
          levels: resolveEmoji('chartpie', '📊'),
          automation: resolveEmoji('settings', '⚙️'),
          invite: resolveEmoji('mail', '✉️'),
          greet: resolveEmoji('folder', '📁'),
          economy: resolveEmoji('gift', '🎁'),
          games: resolveEmoji('playerplay', '🎮'),
          utils: resolveEmoji('adjustments', '🛠️'),
          music: resolveEmoji('music_play', '🎵')
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
          utils: 'الأدوات العامة',
          music: 'الموسيقى'
        };

        const categoryEmoji = categoryEmojis[category] || '📁';
        const catName = arNames[category] || category;

        const header = `__قائمة أوامر قسم '${catName}'__\nعدد الأوامر **'${commandList.length}'**\n\n`;
        const content =
          commandList.length > 0 ? header + commandList.join('\n\n') : `'لا توجد أوامر في هذا القسم حالياً'`;

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(`${categoryEmoji} __أوامر ${catName}__`)
          .setDescription(content)
          .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `طلب بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        return interaction.update({ embeds: [embed] }).catch(() => null);
      }

      if (interaction.isButton()) {
        const id = interaction.customId;

        // ═══════════════════════════════════════════
        // Suggestion Public Vote Buttons
        // ═══════════════════════════════════════════
        if (id === 'suggest_vote_up' || id === 'suggest_vote_down') {
          await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);
          const suggestion = db.getSuggestion(interaction.message.id);
          if (!suggestion) {
            return interaction.editReply({ content: '{emoji:circlex} لم يتم العثور على بيانات هذا الاقتراح' });
          }

          if (!suggestion.upvoters) suggestion.upvoters = [];
          if (!suggestion.downvoters) suggestion.downvoters = [];

          const userId = interaction.user.id;
          const isUp = id === 'suggest_vote_up';

          if (isUp) {
            if (suggestion.upvoters.includes(userId)) {
              suggestion.upvoters = suggestion.upvoters.filter((uid) => uid !== userId);
            } else {
              suggestion.upvoters.push(userId);
              suggestion.downvoters = suggestion.downvoters.filter((uid) => uid !== userId);
            }
          } else {
            if (suggestion.downvoters.includes(userId)) {
              suggestion.downvoters = suggestion.downvoters.filter((uid) => uid !== userId);
            } else {
              suggestion.downvoters.push(userId);
              suggestion.upvoters = suggestion.upvoters.filter((uid) => uid !== userId);
            }
          }

          db.updateSuggestionVotes(suggestion.messageId, suggestion.upvoters, suggestion.downvoters);

          const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
          const newRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('suggest_vote_up')
              .setLabel(`موافق 👍 (${suggestion.upvoters.length})`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('suggest_vote_down')
              .setLabel(`معارض 👎 (${suggestion.downvoters.length})`)
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.message.edit({ embeds: [originalEmbed], components: [newRow] }).catch(() => null);
          return interaction.editReply({ content: '{emoji:circlecheck} تم تسجيل صوتك بنجاح' });
        }

        // ═══════════════════════════════════════════
        // Suggestion Staff Review Buttons (Accept / Reject)
        // ═══════════════════════════════════════════
        if (id.startsWith('suggest_accept_') || id.startsWith('suggest_reject_')) {
          const isAccept = id.startsWith('suggest_accept_');
          const suggestMsgId = isAccept ? id.replace('suggest_accept_', '') : id.replace('suggest_reject_', '');

          if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
              content: '{emoji:circlex} ليس لديك صلاحية لإدارة الاقتراحات.',
              flags: ['Ephemeral']
            });
          }

          const modal = new ModalBuilder()
            .setCustomId(isAccept ? `suggest_modal_accept_${suggestMsgId}` : `suggest_modal_reject_${suggestMsgId}`)
            .setTitle(isAccept ? 'قبول الاقتراح' : 'رفض الاقتراح');

          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel(isAccept ? 'ملاحظة القبول (اختياري)' : 'سبب الرفض (إجباري)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(!isAccept)
            .setPlaceholder(isAccept ? 'اكتب ملاحظتك هنا...' : 'اكتب سبب الرفض هنا...');

          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          return interaction.showModal(modal);
        }

        // ═══════════════════════════════════════════
        // Forms: Apply Button Click
        // ═══════════════════════════════════════════
        if (id === 'form_apply') {
          const settings = db.getFormsSettings(interaction.guildId);
          if (!settings || !settings.questions || settings.questions.length === 0) {
            return interaction.reply({
              content: '{emoji:circlex} نظام التقديمات غير مكتمل الإعداد حالياً.',
              flags: ['Ephemeral']
            });
          }

          const existing = db.getFormSubmission(interaction.guildId, 'admin_form', interaction.user.id);
          if (existing) {
            return interaction.reply({
              content: '{emoji:circlex} لديك طلب تقديم قيد المراجعة بالفعل.',
              flags: ['Ephemeral']
            });
          }

          const modal = new ModalBuilder().setCustomId('form_submit_modal').setTitle('استمارة التقديم');

          settings.questions.forEach((q, idx) => {
            const input = new TextInputBuilder()
              .setCustomId(`q_${idx}`)
              .setLabel(q.label)
              .setPlaceholder(q.placeholder || 'اكتب هنا...')
              .setStyle(q.style === 'SHORT' ? TextInputStyle.Short : TextInputStyle.Paragraph)
              .setRequired(q.required ?? true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
          });

          return interaction.showModal(modal);
        }

        // ═══════════════════════════════════════════
        // Forms Staff Buttons: Accept / Reject
        // ═══════════════════════════════════════════
        if (id.startsWith('form_accept_') || id.startsWith('form_reject_')) {
          const isAccept = id.startsWith('form_accept_');
          const targetUserId = isAccept ? id.replace('form_accept_', '') : id.replace('form_reject_', '');

          if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
              content: '{emoji:circlex} ليس لديك صلاحية لإدارة التقديمات.',
              flags: ['Ephemeral']
            });
          }

          const modal = new ModalBuilder()
            .setCustomId(isAccept ? `form_modal_accept_${targetUserId}` : `form_modal_reject_${targetUserId}`)
            .setTitle(isAccept ? 'قبول طلب التقديم' : 'رفض طلب التقديم');

          const noteInput = new TextInputBuilder()
            .setCustomId('note')
            .setLabel(isAccept ? 'ملاحظة القبول (اختياري)' : 'سبب الرفض (إجباري)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(!isAccept)
            .setPlaceholder(isAccept ? 'اكتب ملاحظتك هنا...' : 'اكتب سبب الرفض هنا...');

          modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
          return interaction.showModal(modal);
        }

        if (id === 'ticket_delete') {
          if (!interaction.channel || !interaction.guild) return;
          const ticket = db.getTicketByChannel(interaction.channel.id);
          if (!ticket) {
            return interaction.reply({
              content: '{emoji:circlex} لم يتم العثور على بيانات التذكرة',
              flags: ['Ephemeral']
            });
          }

          const settings = db.getTicketSettings(interaction.guild.id);
          const staffRole = settings?.staff_role;
          const hasBypass =
            interaction.member?.permissions?.has('Administrator') ||
            (staffRole && interaction.member?.roles?.cache?.has(staffRole));

          if (!hasBypass) {
            return interaction.reply({
              content: '{emoji:circlex} هذا الإجراء مخصص لطاقم الدعم والإدارة فقط.',
              flags: ['Ephemeral']
            });
          }

          await interaction.reply({ content: '{emoji:trash} سيتم حذف التذكرة نهائياً خلال 5 ثواني...' });

          setTimeout(async () => {
            try {
              await interaction.channel?.delete().catch(() => null);
            } catch (err) {
              logger.error('[Ticket Delete Error]', err);
            }
          }, 5000);

          await logTicket(
            interaction.guild,
            settings,
            '{emoji:trash} Ticket Deleted',
            `التذكرة: ${interaction.channel?.name || ''}\nحذفت بواسطة: ${interaction.user}`,
            '#ef4444'
          );
          return;
        }

        if (id === 'ticket_reopen') {
          if (!interaction.channel || !interaction.guild) return;
          const ticket = db.getTicketByChannel(interaction.channel.id);
          if (!ticket) {
            return interaction.reply({
              content: '{emoji:circlex} لم يتم العثور على بيانات التذكرة',
              flags: ['Ephemeral']
            });
          }

          const settings = db.getTicketSettings(interaction.guild.id);
          const staffRole = settings?.staff_role;
          const hasBypass =
            interaction.member?.permissions?.has('Administrator') ||
            (staffRole && interaction.member?.roles?.cache?.has(staffRole));

          if (!hasBypass) {
            return interaction.reply({
              content: '{emoji:circlex} هذا الإجراء مخصص لطاقم الدعم والإدارة فقط.',
              flags: ['Ephemeral']
            });
          }

          db.updateTicketStatus(interaction.channel.id, 'open');
          await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: true, SendMessages: true });

          await interaction.reply({ content: '{emoji:tv_unlock} تم إعادة فتح التذكرة بنجاح' });

          await logTicket(
            interaction.guild,
            settings,
            '{emoji:tv_unlock} Ticket Reopened',
            `بواسطة: ${interaction.user}`
          );
          return;
        }

        if (id.startsWith('box_')) {
          if (id === 'box_claimed') return;

          const parts = id.split('_');
          const prize = decodeURIComponent(parts.slice(3).join('_'));

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('box_claimed')
              .setLabel('تم الاستلام')
              .setEmoji('1519212237317865553')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

          const winEmbed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('{emoji:gift} تم الاستلام')
            .setDescription(`${interaction.user} استلم صندوق الغموض\n**الجائزة** ${prize}`)
            .setTimestamp();

          await interaction.update({ embeds: [winEmbed], components: [disabledRow] });
          return;
        }

        if (id.startsWith('rr_') && id !== 'rr_select') {
          if (interaction.replied || interaction.deferred) return;
          const parts = id.split('_');
          const roleId = parts[1];

          await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);
          if (interaction.replied || interaction.deferred) {
            // Check if defer succeeded
          } else {
            return;
          }

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
          try {
            questions = JSON.parse(settings.questions || '[]');
          } catch (error) {
            // Invalid JSON in settings - use empty array
            logger.warn('Invalid JSON in forms settings for guild:', interaction.guildId, ', error:', error.message);
          }

          if (questions.length === 0) {
            return interaction.reply({ content: locale.get('forms.noQuestions'), flags: ['Ephemeral'] });
          }

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

          const embed = EmbedBuilder.from(interaction.message?.embeds?.[0]);
          embed.setColor(isAccept ? 0x57f287 : 0xed4245);
          embed.setFooter({
            text: isAccept
              ? locale.get('forms.panelAccepted', { user: interaction.user.tag })
              : locale.get('forms.panelRejected', { user: interaction.user.tag })
          });

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
              user
                .send({
                  content: isAccept
                    ? locale.get('forms.dmAccepted', { server: interaction.guild.name })
                    : locale.get('forms.dmRejected', { server: interaction.guild.name })
                })
                .catch(() => null);
            }
          } catch (error) {
            // Failed to send DM - user might have DMs disabled
            logger.debug('Could not send form result DM to user:', error.message);
          }
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

          const row = interaction.message?.components?.[0];
          const newComponents = row.components.map((c) => ButtonBuilder.from(c).setDisabled(true));
          const disabledRow = new ActionRowBuilder().addComponents(newComponents);
          await interaction.editReply({ content: locale.get('broadcast.starting'), components: [disabledRow] });

          let members = await interaction.guild.members.fetch().catch(() => null);
          if (!members) {
            return interaction.followUp({ content: locale.get('broadcast.fetchFailed'), flags: ['Ephemeral'] });
          }

          members = members.filter((m) => !m.user.bot);

          if (target === 'online') {
            members = members.filter((m) => m.presence && m.presence.status !== 'offline');
          } else if (target === 'offline') {
            members = members.filter((m) => !m.presence || m.presence.status === 'offline');
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

          await Promise.all(
            activeBots.map(async (bot, botIndex) => {
              const myMembers = chunks[botIndex];
              for (const member of myMembers) {
                try {
                  await new Promise((r) => setTimeout(r, 1500));
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
            })
          );

          for (const helper of helperClients) {
            try {
              await helper.destroy();
            } catch (error) {
              // Failed to destroy helper client - not critical
              logger.debug('Error destroying helper client:', error.message);
            }
          }

          global.bcCache.delete(bcKey);

          return interaction
            .followUp({ content: locale.get('broadcast.completed', { sent, failed }) })
            .catch(() => null);
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

          for (let i = 0; i < 5; i++) {
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

          for (let i = 0; i < text.length; i++) {
            ctx.save();
            ctx.translate(30 + i * 35, 50);
            ctx.rotate((Math.random() - 0.5) * 0.4);
            ctx.fillText(text[i], 0, 0);
            ctx.restore();
          }

          const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'captcha.png' });

          const ansBtn = locale.getButton('buttons.captchaAnswer');
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('verify_answer')
              .setLabel(ansBtn.label)
              .setEmoji(ansBtn.emoji)
              .setStyle(ButtonStyle.Primary)
          );

          return interaction.reply({
            content: locale.get('captcha.instruction'),
            files: [attachment],
            components: [row],
            flags: ['Ephemeral']
          });
        }

        if (id === 'verify_answer') {
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

        if (id.startsWith('tv_')) {
          let channel = interaction.channel;
          let channelId = interaction.channelId;

          if (channel.type !== ChannelType.GuildVoice) {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
              const emojis = require('../utils/emojis.json');
              return interaction.reply({
                content: `${emojis.circlex || '❌'} **يجب أن تكون في غرفتك الصوتية لتتمكن من التحكم بها**`,
                flags: ['Ephemeral']
              });
            }
            channel = voiceChannel;
            channelId = voiceChannel.id;
          }

          const tvChannel = db.getTempVoiceChannel(channelId);
          if (!tvChannel) {
            const emojis = require('../utils/emojis.json');
            return interaction.reply({
              content: `${emojis.circlex || '❌'} **هذه ليست غرفة مؤقتة صالحة**`,
              flags: ['Ephemeral']
            });
          }

          const isOwner = tvChannel.ownerId === interaction.user.id;
          const isTrusted = db.isTempVoiceTrusted(channelId, interaction.user.id);

          const emojis = require('../utils/emojis.json');

          if (!isOwner && !isTrusted) {
            return interaction.reply({
              content: `${emojis.circlex || '❌'} **لا تملك صلاحية التحكم بهذه الغرفة**`,
              flags: ['Ephemeral']
            });
          }

          if ((id === 'tv_trust' || id === 'tv_ban') && !isOwner) {
            return interaction.reply({
              content: `${emojis.circlex || '❌'} **هذه الصلاحية لمالك الغرفة الأساسي فقط**`,
              flags: ['Ephemeral']
            });
          }

          if (id === 'tv_lock') {
            await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
            if (tvChannel?.ownerId) {
              await channel.permissionOverwrites
                .edit(tvChannel.ownerId, { Connect: true, ViewChannel: true })
                .catch(() => null);
            }
            const trustedList = db.getTempVoiceTrustedUsers(channelId) || [];
            for (const t of trustedList) {
              await channel.permissionOverwrites.edit(t.userId, { Connect: true, ViewChannel: true }).catch(() => null);
            }
            return interaction.reply({
              content: `${emojis.tv_lock || '🔒'} **تم قفل الغرفة، لا يمكن للمجهولين الدخول**`,
              flags: ['Ephemeral']
            });
          }

          if (id === 'tv_unlock') {
            await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
            return interaction.reply({
              content: `${emojis.tv_unlock || '🔓'} **تم فتح الغرفة للجميع**`,
              flags: ['Ephemeral']
            });
          }

          if (id === 'tv_hide') {
            await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
            return interaction.reply({
              content: `${emojis.tv_hide || '👁️‍🗨️'} **تم إخفاء الغرفة**`,
              flags: ['Ephemeral']
            });
          }

          if (id === 'tv_show') {
            await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
            return interaction.reply({
              content: `${emojis.tv_show || '👁️'} **تم إظهار الغرفة**`,
              flags: ['Ephemeral']
            });
          }

          if (id === 'tv_limit') {
            const modal = new ModalBuilder().setCustomId(`tv_modal_limit_${channelId}`).setTitle('تحديد عدد الأشخاص');
            const input = new TextInputBuilder()
              .setCustomId('limit_input')
              .setLabel('العدد (0 مفتوح، الحد الأقصى 99)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
          }

          if (id === 'tv_rename') {
            const modal = new ModalBuilder().setCustomId(`tv_modal_rename_${channelId}`).setTitle('تغيير اسم الغرفة');
            const input = new TextInputBuilder()
              .setCustomId('rename_input')
              .setLabel('الاسم الجديد')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
          }

          if (id === 'tv_kick') {
            const select = new UserSelectMenuBuilder()
              .setCustomId(`tv_select_kick_${channelId}`)
              .setPlaceholder('اختر الشخص لطرده من الروم')
              .setMaxValues(1);

            return interaction.reply({
              content: `${emojis.tv_kick || '👢'} **اختر الشخص لطرده من الروم**`,
              components: [new ActionRowBuilder().addComponents(select)],
              flags: ['Ephemeral']
            });
          }

          if (id === 'tv_trust') {
            const select = new UserSelectMenuBuilder()
              .setCustomId(`tv_select_trust_${channelId}`)
              .setPlaceholder('اختر الشخص لإضافته أو إزالته كمسؤول مساعد')
              .setMaxValues(1);

            return interaction.reply({
              content: `${emojis.tv_trust || '👑'} **اختر شخصاً لإعطائه أو سحب صلاحيات المساعد منه في غرفتك الصوتية**`,
              components: [new ActionRowBuilder().addComponents(select)],
              flags: ['Ephemeral']
            });
          }

          if (id === 'tv_ban') {
            const select = new UserSelectMenuBuilder()
              .setCustomId(`tv_select_ban_${channelId}`)
              .setPlaceholder('اختر الشخص لحظره أو إلغاء حظره')
              .setMaxValues(1);

            return interaction.reply({
              content: `${emojis.tv_ban || '🚫'} **اختر شخصاً لحظر أو إلغاء حظر دخوله لغرفتك الصوتية**`,
              components: [new ActionRowBuilder().addComponents(select)],
              flags: ['Ephemeral']
            });
          }
        }
      }

      if (interaction.isModalSubmit()) {
        // ═══════════════════════════════════════════
        // Suggestion Admin Modal Submissions
        // ═══════════════════════════════════════════
        if (
          interaction.customId.startsWith('suggest_modal_accept_') ||
          interaction.customId.startsWith('suggest_modal_reject_')
        ) {
          await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);
          const isAccept = interaction.customId.startsWith('suggest_modal_accept_');
          const suggestMsgId = isAccept
            ? interaction.customId.replace('suggest_modal_accept_', '')
            : interaction.customId.replace('suggest_modal_reject_', '');
          const note = interaction.fields.getTextInputValue('reason') || (isAccept ? 'لا توجد ملاحظات' : 'بدون سبب');

          const suggestion = db.getSuggestion(suggestMsgId);
          if (!suggestion) {
            return interaction.editReply({ content: '{emoji:circlex} لم يتم العثور على بيانات هذا الاقتراح' });
          }

          db.updateSuggestionStatus(suggestMsgId, isAccept ? 'accepted' : 'rejected', interaction.user.id, note);

          const settings = db.getSuggestionSettings(interaction.guildId);
          if (settings && settings.channelId) {
            const publicChan = interaction.guild.channels.cache.get(settings.channelId);
            if (publicChan) {
              const publicMsg = await publicChan.messages.fetch(suggestMsgId).catch(() => null);
              if (publicMsg && publicMsg.embeds[0]) {
                const originalEmbed = EmbedBuilder.from(publicMsg.embeds[0]);
                originalEmbed.setColor(isAccept ? 0x57f287 : 0xed4245);

                const fields = originalEmbed.data.fields || [];
                const statusIdx = fields.findIndex((f) => f.name.includes('الحالة'));
                const statusVal = isAccept
                  ? `{emoji:circlecheck} **تم القبول**\n- **المشرف:** <@${interaction.user.id}>\n- **ملاحظة:** '${note}'`
                  : `{emoji:circlex} **تم الرفض**\n- **المشرف:** <@${interaction.user.id}>\n- **السبب:** '${note}'`;

                if (statusIdx !== -1) {
                  fields[statusIdx].value = statusVal;
                } else {
                  fields.push({ name: '**الحالة:**', value: statusVal, inline: true });
                }

                originalEmbed.setFields(fields);
                await publicMsg.edit({ embeds: [originalEmbed], components: [] }).catch(() => null);
              }
            }
          }

          if (interaction.message) {
            const reviewEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
            reviewEmbed.setColor(isAccept ? 0x57f287 : 0xed4245);
            reviewEmbed.addFields({
              name: isAccept ? '**حالة المراجعة: مقبول ✅**' : '**حالة المراجعة: مرفوض ❌**',
              value: `- **المراجع:** <@${interaction.user.id}>\n- **السبب/الملاحظة:** '${note}'`
            });
            await interaction.message.edit({ embeds: [reviewEmbed], components: [] }).catch(() => null);
          }

          return interaction.editReply({
            content: `{emoji:circlecheck} تم معالجة الاقتراح بنجاح كـ ${isAccept ? 'مقبول' : 'مرفوض'}`
          });
        }

        // ═══════════════════════════════════════════
        // Forms: Apply Modal Submission
        // ═══════════════════════════════════════════
        if (interaction.customId === 'form_submit_modal') {
          await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);
          const settings = db.getFormsSettings(interaction.guildId);
          if (!settings || !settings.questions || settings.questions.length === 0 || !settings.log_channel) {
            return interaction.editReply({ content: '{emoji:circlex} إعدادات نظام التقديمات غير كاملة.' });
          }

          const answers = [];
          settings.questions.forEach((q, idx) => {
            const val = interaction.fields.getTextInputValue(`q_${idx}`);
            answers.push({ question: q.label, answer: val });
          });

          db.addFormSubmission(interaction.guildId, 'admin_form', interaction.user.id, interaction.user.tag, answers);

          const logChannel = interaction.guild.channels.cache.get(settings.log_channel);
          if (logChannel) {
            const reviewEmbed = new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle('__طلب تقديم جديد على الإدارة__')
              .setDescription(`قدمه العضو <@${interaction.user.id}> (${interaction.user.tag})`)
              .setThumbnail(interaction.user.displayAvatarURL({}))
              .setTimestamp();

            answers.forEach((ans, idx) => {
              reviewEmbed.addFields({ name: `**س${idx + 1}: ${ans.question}**`, value: ans.answer, inline: false });
            });

            const reviewRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`form_accept_${interaction.user.id}`)
                .setLabel('قبول طلب العضو ✅')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`form_reject_${interaction.user.id}`)
                .setLabel('رفض طلب العضو ❌')
                .setStyle(ButtonStyle.Danger)
            );

            await logChannel.send({ embeds: [reviewEmbed], components: [reviewRow] }).catch(() => null);
          }

          return interaction.editReply({
            content: '{emoji:circlecheck} تم إرسال استمارة تقديمك بنجاح وجارٍ مراجعتها من قبل الإدارة'
          });
        }

        // ═══════════════════════════════════════════
        // Forms Staff Modal Submission (Accept / Reject)
        // ═══════════════════════════════════════════
        if (
          interaction.customId.startsWith('form_modal_accept_') ||
          interaction.customId.startsWith('form_modal_reject_')
        ) {
          await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);
          const isAccept = interaction.customId.startsWith('form_modal_accept_');
          const targetUserId = isAccept
            ? interaction.customId.replace('form_modal_accept_', '')
            : interaction.customId.replace('form_modal_reject_', '');
          const note = interaction.fields.getTextInputValue('note') || (isAccept ? 'لا توجد ملاحظات' : 'بدون سبب');

          db.updateFormSubmissionStatus(
            interaction.guildId,
            'admin_form',
            targetUserId,
            isAccept ? 'accepted' : 'rejected',
            interaction.user.id,
            note
          );

          if (interaction.message) {
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
            updatedEmbed.setColor(isAccept ? 0x57f287 : 0xed4245);
            updatedEmbed.addFields({
              name: isAccept ? '**القرار: مقبول ✅**' : '**القرار: مرفوض ❌**',
              value: `- **بواسطة:** <@${interaction.user.id}>\n- **السبب/الملاحظة:** '${note}'`
            });
            await interaction.message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
          }

          const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
          const settings = db.getFormsSettings(interaction.guildId);

          if (targetMember) {
            if (isAccept && settings.panel_data && settings.panel_data.accept_role) {
              const role = interaction.guild.roles.cache.get(settings.panel_data.accept_role);
              if (role) await targetMember.roles.add(role).catch(() => null);
            }

            await targetMember
              .send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(isAccept ? 0x57f287 : 0xed4245)
                    .setTitle(`__تحديث بشأن طلب تقديمك في سيرفر ${interaction.guild.name}__`)
                    .setDescription(
                      isAccept
                        ? `{emoji:circlecheck} **مبارك! تم قبول طلب انضمامك للإدارة**\n- **الملاحظات:** '${note}'`
                        : `{emoji:circlex} **نعتذر منك، تم رفض طلب التقديم الخاص بك**\n- **السبب:** '${note}'`
                    )
                    .setTimestamp()
                ]
              })
              .catch(() => null);
          }

          return interaction.editReply({
            content: `{emoji:circlecheck} تم معالجة الطلب بنجاح وإرسال القرار لـ <@${targetUserId}>`
          });
        }

        if (interaction.customId.startsWith('say_modal_')) {
          const channelId = interaction.customId.replace('say_modal_', '');
          const text = interaction.fields.getTextInputValue('message_text');
          const targetChannel = interaction.guild.channels.cache.get(channelId);

          if (!targetChannel) {
            const { error } = require('../utils/embeds');
            return interaction.reply({ embeds: [error('لم يتم العثور على القناة المحددة.')], flags: ['Ephemeral'] });
          }

          try {
            await targetChannel.send({ content: text });
            const { success } = require('../utils/embeds');
            return interaction.reply({
              embeds: [success(`تم إرسال الرسالة بنجاح في ${targetChannel}`)],
              flags: ['Ephemeral']
            });
          } catch (e) {
            const { error } = require('../utils/embeds');
            return interaction.reply({
              embeds: [error('فشل إرسال الرسالة. تأكد من صلاحيات البوت في القناة المحددة.')],
              flags: ['Ephemeral']
            });
          }
        }

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
            .setColor(0x5865f2)
            .setTitle(locale.get('forms.newAppTitle'))
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

          interaction.fields.fields.forEach((field) => {
            embed.addFields({ name: field.customId.replace('question_', 'س '), value: field.value || 'لا يوجد' });
          });

          const acceptBtn = locale.getButton('buttons.formAccept');
          const rejectBtn = locale.getButton('buttons.formReject');

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`form_accept_${interaction.user.id}`)
              .setLabel(acceptBtn.label)
              .setEmoji(acceptBtn.emoji)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`form_reject_${interaction.user.id}`)
              .setLabel(rejectBtn.label)
              .setEmoji(rejectBtn.emoji)
              .setStyle(ButtonStyle.Danger)
          );

          await logCh.send({ content: `تقديم جديد من ${interaction.user}`, embeds: [embed], components: [row] });
          return interaction.reply({ content: locale.get('forms.successSubmit'), flags: ['Ephemeral'] });
        }

        if (interaction.customId === 'bc_modal') {
          const message = interaction.fields.getTextInputValue('bc_message');
          const bcKey = `${interaction.guildId}:${interaction.user.id}`;

          if (!global.bcCache) global.bcCache = new Map();
          global.bcCache.set(bcKey, message);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('bc_send_online')
              .setLabel(locale.get('broadcast.btnOnline'))
              .setEmoji('1519212246876557413')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('bc_send_offline')
              .setLabel(locale.get('broadcast.btnOffline'))
              .setEmoji('1519212245559672914')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('bc_send_all')
              .setLabel(locale.get('broadcast.btnAll'))
              .setEmoji('1519212186633764995')
              .setStyle(ButtonStyle.Secondary)
          );

          return interaction
            .reply({
              content: locale.get('broadcast.selectTarget', {
                message: message.substring(0, 500) + (message.length > 500 ? '...' : '')
              }),
              components: [row],
              flags: ['Ephemeral']
            })
            .catch(() => null);
        }
        if (interaction.customId.startsWith('tv_modal_limit_')) {
          const channelId = interaction.customId.split('_').pop();
          const targetChannel = interaction.guild.channels.cache.get(channelId);
          if (!targetChannel) return interaction.reply({ content: 'الغرفة الصوتية غير موجودة', flags: ['Ephemeral'] });

          const limit = parseInt(interaction.fields.getTextInputValue('limit_input'));
          if (isNaN(limit) || limit < 0 || limit > 99) {
            const emojis = require('../utils/emojis.json');
            return interaction.reply({
              content: `${emojis.circlex || '❌'} **يرجى كتابة رقم صحيح بين 0 و 99**`,
              flags: ['Ephemeral']
            });
          }
          await targetChannel.setUserLimit(limit);

          const userSettings = db.getTempVoiceUserSettings(interaction.user.id);
          const preferredName = userSettings?.preferredName || null;
          db.saveTempVoiceUserSettings(interaction.user.id, preferredName, limit);

          const emojis = require('../utils/emojis.json');
          return interaction.reply({
            content: `${emojis.tv_limit || '👥'} **تم تغيير حد الغرفة إلى ${limit === 0 ? 'مفتوح' : limit}**`,
            flags: ['Ephemeral']
          });
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
          return interaction.reply({
            content: `${emojis.tv_rename || '✏️'} **تم تغيير اسم الغرفة إلى: ${name}**`,
            flags: ['Ephemeral']
          });
        }
      }

      if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) {
        if (interaction.customId.startsWith('tv_select_kick_')) {
          const channelId = interaction.customId.split('_').pop();
          const targetId = interaction.values[0];
          const member = await interaction.guild.members.fetch(targetId).catch(() => null);
          const emojis = require('../utils/emojis.json');
          if (!member || !member.voice.channel || member.voice.channelId !== channelId) {
            return interaction.update({
              content: `${emojis.circlex || '❌'} **العضو ليس موجوداً في غرفتك الصوتية**`,
              components: []
            });
          }
          if (targetId === interaction.user.id) {
            return interaction.update({ content: `${emojis.circlex || '❌'} **لا يمكنك طرد نفسك**`, components: [] });
          }

          try {
            await member.voice.disconnect();
            return interaction.update({
              content: `${emojis.tv_kick || '👢'} **تم طرد ${member} من الغرفة**`,
              components: []
            });
          } catch (error) {
            return interaction.update({
              content: `${emojis.circlex || '❌'} **حدث خطأ أثناء طرد العضو**`,
              components: []
            });
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
            return interaction.update({
              content: `${emojis.circlex || '❌'} **لا يمكنك تعيين نفسك كمساعد**`,
              components: []
            });
          }

          const isAlreadyTrusted = db.isTempVoiceTrusted(channelId, targetId);

          if (isAlreadyTrusted) {
            db.removeTempVoiceTrusted(channelId, targetId);
            await targetChannel.permissionOverwrites.delete(targetId).catch(() => null);
            return interaction.update({
              content: `${emojis.tv_trust || '👑'} **تم سحب صلاحيات المسؤول المساعد من ${member}**`,
              components: []
            });
          } else {
            db.addTempVoiceTrusted(channelId, targetId);
            await targetChannel.permissionOverwrites
              .edit(targetId, { ViewChannel: true, Connect: true })
              .catch(() => null);
            return interaction.update({
              content: `${emojis.tv_trust || '👑'} **تم تعيين ${member} كمسؤول مساعد في الغرفة**`,
              components: []
            });
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
            return interaction.update({
              content: `${emojis.tv_ban || '🚫'} **تم إلغاء حظر ${member} من دخول الغرفة**`,
              components: []
            });
          } else {
            db.addTempVoiceBan(channelId, targetId);
            await targetChannel.permissionOverwrites
              .edit(targetId, { ViewChannel: false, Connect: false })
              .catch(() => null);

            if (member.voice.channelId === channelId) {
              await member.voice.disconnect().catch(() => null);
            }

            return interaction.update({
              content: `${emojis.tv_ban || '🚫'} **تم حظر ${member} من دخول الغرفة**`,
              components: []
            });
          }
        }
      }

      if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

      let categoryName = 'general';
      let chosenCategoryId = null;
      let matchedCat = null;

      const isTicketButton = interaction.isButton() && interaction.customId === 'ticket_create_btn';
      const isTicketSelect = interaction.isStringSelectMenu() && interaction.customId === 'ticket_create_select';

      if (isTicketButton || isTicketSelect) {
        if (isTicketSelect && interaction.values?.length > 0) {
          const val = interaction.values[0];
          if (val.startsWith('ticket_cat_')) {
            categoryName = val.replace('ticket_cat_', '');
            const categories = db.getTicketCategories(interaction.guild.id) || [];
            matchedCat = categories.find((c) => c.name === categoryName);
            if (matchedCat) {
              chosenCategoryId = matchedCat.categoryId || matchedCat.category_id || null;
            }
          }
        }

        const settings = await db.getTicketSettings(interaction.guild.id);

        const panelData = settings.panel_data || {};
        const targetParentId = chosenCategoryId || settings.category_id || null;

        const existing = interaction.guild.channels.cache.find((c) => c.topic === `ticket:${interaction.user.id}`);

        const blocked = db.isTicketBlacklisted(interaction.guild.id, interaction.user.id);

        if (blocked) {
          return interaction.reply({
            content: '{emoji:circlex} أنت ممنوع من فتح التذاكر في هذا السيرفر',
            flags: ['Ephemeral']
          });
        }

        if (existing) {
          return interaction.reply({
            content: `{emoji:circlex} لديك تذكرة مفتوحة بالفعل: ${existing}`,
            flags: ['Ephemeral']
          });
        }

        const staffRoleToUse =
          (matchedCat && (matchedCat.staffRoleId || matchedCat.staff_role)) || settings.staff_role || null;

        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,

          parent: targetParentId,

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

            ...(staffRoleToUse
              ? [
                  {
                    id: staffRoleToUse,
                    allow: [
                      PermissionsBitField.Flags.ViewChannel,
                      PermissionsBitField.Flags.SendMessages,
                      PermissionsBitField.Flags.ReadMessageHistory
                    ]
                  }
                ]
              : [])
          ]
        });

        await db.createTicket(interaction.guild.id, interaction.user.id, channel.id, categoryName);

        const buttons = [
          new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success),

          new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
        ];

        const menuOptions = [
          {
            label: 'إضافة عضو',
            value: 'add_member'
          },

          {
            label: 'إزالة عضو',
            value: 'remove_member'
          }
        ];

        const actionLabels = {
          call_user: 'Call User',
          call_support: 'Call Support',
          call_owners: 'Call Owners',
          warn_user: 'Warn User',
          blacklist_user: 'Blacklist User',
          rename_ticket: 'Rename Ticket',
          lock_ticket: 'Lock Ticket',
          unlock_ticket: 'Unlock Ticket'
        };

        if (panelData.panel_mode === 'advanced' && panelData.actions) {
          for (const [action, mode] of Object.entries(panelData.actions || {})) {
            if (mode === 'button') {
              buttons.push(
                new ButtonBuilder()
                  .setCustomId(action)
                  .setLabel(actionLabels[action] || action)
                  .setStyle(ButtonStyle.Secondary)
              );
            }

            if (mode === 'menu') {
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
              .setStyle(ButtonStyle[btn.style] || ButtonStyle.Primary)
          );
        }

        const rows = [];

        for (let i = 0; i < buttons.length; i += 5) {
          rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('ticket_control_menu')
              .setPlaceholder('لوحة التحكم')
              .addOptions(menuOptions)
          )
        );

        for (const menu of panelData.custom_menus || []) {
          if (!menu.options?.length) continue;

          rows.push(
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`custom_menu_${rows.length}`)
                .setPlaceholder(menu.placeholder || 'اختر')
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

        if (ticketStyle.type === 'embed') {
          const Description1 = (ticketStyle.embed?.description || '')
            .replaceAll('{user}', `<@${interaction.user.id}>`)
            .replaceAll('{user_tag}', interaction.user.tag)
            .replaceAll('{server}', interaction.guild.name)
            .replaceAll('{ticket}', channel.name);

          const embed = new EmbedBuilder()
            .setColor(ticketStyle.embed?.color || '#5865F2')
            .setTitle(ticketStyle.embed?.title || 'تذكرة جديدة')
            .setDescription(Description1);

          if (ticketStyle.embed?.thumbnail) embed.setThumbnail(ticketStyle.embed.thumbnail);

          if (ticketStyle.embed?.image) embed.setImage(ticketStyle.embed.image);

          if (ticketStyle.embed?.footer)
            embed.setFooter({
              text: ticketStyle.embed.footer,
              iconURL: ticketStyle.embed.footer_icon || null
            });

          await channel.send({
            content: `<@${interaction.user.id}> - <@&${settings.staff_role}>`,
            embeds: [embed],
            components: rows
          });
        } else if (ticketStyle.type === 'plain') {
          const content = (ticketStyle.plain?.content || settings.ticket_message)
            .replaceAll('{user}', `<@${interaction.user.id}>`)
            .replaceAll('{user_tag}', interaction.user.tag)
            .replaceAll('{server}', interaction.guild.name)
            .replaceAll('{ticket}', channel.name);

          await channel.send({
            content,
            components: rows
          });
        } else if (ticketStyle.type === 'container') {
          const Description = (ticketStyle.container?.description || '')
            .replaceAll('{user}', `<@${interaction.user.id}>`)
            .replaceAll('{user_tag}', interaction.user.tag)
            .replaceAll('{server}', interaction.guild.name)
            .replaceAll('{ticket}', channel.name);

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(ticketStyle.container?.title || 'Container')
            .setDescription(Description);

          await channel.send({
            content: `<@${interaction.user.id}> - <@&${settings.staff_role}>`,
            embeds: [embed],
            components: rows
          });
        } else {
          const content = (settings.ticket_message || 'شكراً لفتح تذكرة! سيقوم الدعم بمساعدتك قريباً.')
            .replaceAll('{user}', `<@${interaction.user.id}>`)
            .replaceAll('{user_tag}', interaction.user.tag)
            .replaceAll('{server}', interaction.guild.name)
            .replaceAll('{ticket}', channel.name);

          const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('تذكرة جديدة').setDescription(content);

          await channel.send({
            content: `<@${interaction.user.id}> - <@&${settings.staff_role}>`,
            embeds: [embed],
            components: rows
          });
        }

        await interaction.reply({
          content: `{emoji:circlecheck} تم إنشاء التذكرة ${channel}`,

          flags: ['Ephemeral']
        });

        await logTicket(
          interaction.guild,
          settings,
          '{emoji:folderopen} Ticket Opened',
          `المستخدم: ${interaction.user}
القناة: ${channel}`
        );
      }

      if (interaction.customId === 'claim_ticket') {
        const ticket = db.getTicketByChannel(interaction.channel.id);

        if (!ticket)
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على بيانات التذكرة',
            flags: ['Ephemeral']
          });

        const settings = db.getTicketSettings(interaction.guild.id);
        const staffRole = settings.staff_role;
        const hasBypass =
          interaction.member?.permissions.has('Administrator') ||
          (staffRole && interaction.member.roles.cache.has(staffRole));

        if (!hasBypass) {
          return interaction.reply({
            content: '{emoji:circlex} هذا الزر مخصص لطاقم الإدارة والدعم فقط.',
            flags: ['Ephemeral']
          });
        }

        if (ticket.claimedBy)
          return interaction.reply({
            content: `{emoji:circlex} التذكرة مستلمة بالفعل بواسطة <@${ticket.claimedBy}>`,
            flags: ['Ephemeral']
          });

        db.claimTicket(interaction.channel.id, interaction.user.id);

        await interaction.reply({
          content: `{emoji:circlecheck} تم استلام التذكرة بواسطة ${interaction.user}`
        });

        await logTicket(
          interaction.guild,
          settings,
          '{emoji:bell} Ticket Claimed',
          `الموظف: ${interaction.user}
القناة: ${interaction.channel}`
        );
      }

      if (interaction.customId === 'close_ticket') {
        const ticket = db.getTicketByChannel(interaction.channel.id);

        if (!ticket)
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على التذكرة',
            flags: ['Ephemeral']
          });

        await interaction.reply({
          content: '{emoji:lock} سيتم إغلاق التذكرة خلال 5 ثواني...'
        });

        const settings = await db.getTicketSettings(interaction.guild.id);

        await logTicket(
          interaction.guild,
          settings,
          '{emoji:circlex} Ticket Closed',
          `بواسطة: ${interaction.user}`,
          '#ef4444'
        );

        const attachment = await discordTranscripts.createTranscript(interaction.channel, {
          limit: -1,
          returnType: 'attachment',
          filename: `${interaction.channel.name}.html`
        });

        const logCh = interaction.guild.channels.cache.get(settings.log_channel);
        if (logCh) {
          await logCh
            .send({
              content: `📂 **سجل التذكرة المغلقة:** \`${interaction.channel.name}\``,
              files: [attachment]
            })
            .catch((err) => logger.error(err));
        }

        const ticketOwner = await interaction.client.users.fetch(ticket.userId).catch(() => null);

        if (ticketOwner) {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`rate_ticket_${interaction.guild.id}_${ticket.channelId}`)
              .setLabel('⭐ تقييم الإدارة')
              .setStyle(ButtonStyle.Primary)
          );

          await ticketOwner
            .send({
              content: '{emoji:star} تم إغلاق تذكرتك، نرجو تقييم فريق الإدارة.',

              components: [row]
            })
            .catch(() => null);
        }

        const channelId = interaction.channel.id;

        setTimeout(async () => {
          try {
            const channel = interaction.guild?.channels?.cache?.get(channelId);

            if (!channel) return;

            await channel.delete().catch(() => null);
          } catch (err) {
            logger.error('[Ticket Close Timeout Error]', err);
          }
        }, 5000);

        db.updateTicketStatus(interaction.channel.id, 'closed');
      }

      let action = null;

      if (interaction.isButton()) {
        action = interaction.customId;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_control_menu') {
        action = interaction.values[0];
      }

      if (!interaction.channel) return;
      const ticket = db.getTicketByChannel(interaction.channel.id);

      const ticketActions = [
        'lock_ticket',
        'unlock_ticket',
        'rename_ticket',
        'add_member',
        'remove_member',
        'blacklist_user',
        'warn_user'
      ];
      if (action && ticketActions.includes(action)) {
        if (!ticket) {
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على بيانات التذكرة.',
            flags: ['Ephemeral']
          });
        }
        const settings = db.getTicketSettings(interaction.guild.id);
        const staffRole = settings.staff_role;
        const hasBypass =
          interaction.member?.permissions.has('Administrator') ||
          (staffRole && interaction.member.roles.cache.has(staffRole));

        if (!hasBypass) {
          return interaction.reply({
            content: '{emoji:circlex} هذا الإجراء مخصص لطاقم الإدارة والدعم فقط.',
            flags: ['Ephemeral']
          });
        }
      }

      if (action === 'lock_ticket') {
        await interaction.channel.permissionOverwrites
          .edit(ticket.userId, {
            SendMessages: false
          })
          .catch(() => null);

        return interaction.reply({
          content: '{emoji:lock} تم قفل التذكرة'
        });
      }

      if (action === 'unlock_ticket') {
        await interaction.channel.permissionOverwrites
          .edit(ticket.userId, {
            SendMessages: true
          })
          .catch(() => null);

        return interaction.reply({
          content: '{emoji:tv_unlock} تم فتح التذكرة'
        });
      }

      if (action === 'rename_ticket') {
        const modal = new ModalBuilder().setCustomId('rename_ticket_modal').setTitle('تغيير اسم التذكرة');

        const nameInput = new TextInputBuilder()
          .setCustomId('new_ticket_name')
          .setLabel('الاسم الجديد')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

        return interaction.showModal(modal);
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'rename_ticket_modal') {
          const newName = interaction.fields.getTextInputValue('new_ticket_name').trim();

          await interaction.channel.setName(newName);

          const settings = await db.getTicketSettings(interaction.guild.id);
          await logTicket(interaction.guild, settings, '{emoji:tv_rename} Ticket Renamed', `الاسم الجديد: ${newName}`);

          return interaction.reply({
            content: `{emoji:tv_rename} تم تغيير اسم التذكرة إلى \`${newName}\``
          });
        }
      }

      if (action === 'add_member') {
        const modal = new ModalBuilder().setCustomId('add_member_modal').setTitle('إضافة عضو');

        const input = new TextInputBuilder()
          .setCustomId('member_id')
          .setLabel('ID أو Mention العضو')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      if (action === 'remove_member') {
        const modal = new ModalBuilder().setCustomId('remove_member_modal').setTitle('إزالة عضو');

        const input = new TextInputBuilder()
          .setCustomId('member_id')
          .setLabel('ID أو Mention العضو')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'add_member_modal') {
        let userId = interaction.fields.getTextInputValue('member_id').trim();

        userId = userId.replace(/[<@!>]/g, '');

        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على العضو',
            flags: ['Ephemeral']
          });
        }

        await interaction.channel.permissionOverwrites.create(member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        const settings = await db.getTicketSettings(interaction.guild.id);
        await logTicket(interaction.guild, settings, '{emoji:user} Member Added', `العضو: @${member.user.tag}`);

        return interaction.reply({
          content: `{emoji:circlecheck} تمت إضافة ${member.user.tag}`
        });
      }

      if (interaction.customId === 'remove_member_modal') {
        let userId = interaction.fields.getTextInputValue('member_id').trim();

        userId = userId.replace(/[<@!>]/g, '');

        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على العضو',
            ephemeral: true
          });
        }

        const ticket = db.getTicketByChannel(interaction.channel.id);

        if (ticket && ticket.userId === member.id) {
          return interaction.reply({
            content: '{emoji:circlex} لا يمكن إزالة صاحب التذكرة',
            flags: ['Ephemeral']
          });
        }

        await interaction.channel.permissionOverwrites.delete(member.id);

        const settings = await db.getTicketSettings(interaction.guild.id);
        await logTicket(
          interaction.guild,
          settings,
          '{emoji:circlex} Member Removed',
          `العضو: @${member.user.tag}`,
          '#ff9900'
        );

        return interaction.reply({
          content: `{emoji:circlex} تمت إزالة ${member.user.tag}`
        });
      }

      if (interaction.customId === 'call_user' || interaction.values?.includes('call_user')) {
        const ticket = db.getTicketByChannel(interaction.channel.id);

        if (!ticket)
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على صاحب التذكرة',
            flags: ['Ephemeral']
          });

        const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);

        if (!user)
          return interaction.reply({
            content: '{emoji:circlex} تعذر الوصول للمستخدم',
            flags: ['Ephemeral']
          });

        await user
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor('Yellow')
                .setTitle('{emoji:clock} تم استدعاؤك')
                .setDescription(`يرجى التوجه إلى التذكرة:\n<#${interaction.channel.id}>`)
            ]
          })
          .catch(() => null);

        return interaction.reply({
          content: '{emoji:circlecheck} تم إرسال الاستدعاء للمستخدم',
          flags: ['Ephemeral']
        });
      }

      if (interaction.customId === 'call_support' || interaction.values?.includes('call_support')) {
        const settings = db.getTicketSettings(interaction.guild.id);

        const role = interaction.guild.roles.cache.get(settings.staff_role);

        if (!role)
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على رتبة الدعم',
            flags: ['Ephemeral']
          });

        let sent = 0;

        for (const member of role.members.values()) {
          await member
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor('Blue')
                  .setTitle('{emoji:clock} استدعاء دعم')
                  .setDescription(`تم طلب الدعم داخل:\n<#${interaction.channel.id}>`)
              ]
            })
            .catch(() => null);

          sent++;
        }

        return interaction.reply({
          content: `{emoji:circlecheck} تم استدعاء ${sent} من طاقم الدعم`,
          flags: ['Ephemeral']
        });
      }

      if (interaction.customId === 'call_owners' || interaction.values?.includes('call_owners')) {
        const settings = db.getTicketSettings(interaction.guild.id);

        const role = interaction.guild.roles.cache.get(settings.owners_role);

        if (!role)
          return interaction.reply({
            content: '{emoji:circlex} لم يتم العثور على رتبة الإدارة',
            flags: ['Ephemeral']
          });

        let sent = 0;

        for (const member of role.members.values()) {
          await member
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor('Red')
                  .setTitle('{emoji:alerttriangle} استدعاء إدارة')
                  .setDescription(`تم طلب الإدارة داخل:\n<#${interaction.channel.id}>`)
              ]
            })
            .catch(() => null);

          sent++;
        }

        return interaction.reply({
          content: `{emoji:circlecheck} تم استدعاء ${sent} من الإدارة`,
          flags: ['Ephemeral']
        });
      }

      if (action === 'blacklist_user') {
        const modal = new ModalBuilder().setCustomId('blacklist_user_modal').setTitle('حظر مستخدم من التذاكر');

        const input = new TextInputBuilder()
          .setCustomId('target_user')
          .setLabel('ID أو Mention')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'blacklist_user_modal') {
        let userId = interaction.fields.getTextInputValue('target_user').trim();

        userId = userId.replace(/[<@!>]/g, '');

        const user = await interaction.client.users.fetch(userId).catch(() => null);

        if (!user) {
          return interaction.reply({
            content: '{emoji:circlex} المستخدم غير موجود',
            flags: ['Ephemeral']
          });
        }

        db.addTicketBlacklist(interaction.guild.id, user.id);

        await interaction.reply({
          content: `{emoji:circlex} تم حظر ${user.tag} من فتح التذاكر`
        });
      }

      if (action === 'warn_user') {
        const modal = new ModalBuilder().setCustomId('warn_user_modal').setTitle('تحذير مستخدم');

        const userInput = new TextInputBuilder()
          .setCustomId('target_user')
          .setLabel('ID أو Mention')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId('warn_reason')
          .setLabel('سبب التحذير')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'warn_user_modal') {
        let userId = interaction.fields.getTextInputValue('target_user').trim();

        const reason = interaction.fields.getTextInputValue('warn_reason');

        userId = userId.replace(/[<@!>]/g, '');

        const user = await interaction.client.users.fetch(userId).catch(() => null);

        if (!user) {
          return interaction.reply({
            content: '{emoji:circlex} المستخدم غير موجود',
            flags: ['Ephemeral']
          });
        }

        db.addTicketWarning(interaction.guild.id, user.id, interaction.user.id, reason);

        const warnings = db.getTicketWarnings(interaction.guild.id, user.id);

        await user
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor('Orange')
                .setTitle('{emoji:alerttriangle} تحذير')
                .setDescription(`لقد تلقيت تحذيراً في ${interaction.guild.name}\n\nالسبب:\n${reason}`)
            ]
          })
          .catch(() => null);

        await interaction.reply({
          content: `{emoji:alerttriangle} تم تحذير ${user.tag}\nعدد التحذيرات: ${warnings.length}`
        });

        const settings = await db.getTicketSettings(interaction.guild.id);
        await logTicket(
          interaction.guild,
          settings,
          '{emoji:alerttriangle} User Warned',
          `المستخدم: @${user.tag}
السبب: ${reason}`,
          '#f59e0b'
        );
      }

      if (interaction.isButton() && interaction.customId.startsWith('rate_ticket_')) {
        const modal = new ModalBuilder().setCustomId(interaction.customId).setTitle('تقييم الإدارة');

        const stars = new TextInputBuilder()
          .setCustomId('stars')
          .setLabel('عدد النجوم (1-5)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const staffIdInput = new TextInputBuilder()
          .setCustomId('staff_id')
          .setLabel('معرف الإداري (ID)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const comment = new TextInputBuilder()
          .setCustomId('comment')
          .setLabel('رأيك')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(stars),
          new ActionRowBuilder().addComponents(staffIdInput),
          new ActionRowBuilder().addComponents(comment)
        );

        await interaction.showModal(modal);
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('rate_ticket_')) {
        const parts = interaction.customId.split('_');
        const guildId = parts[2];

        const stars = interaction.fields.getTextInputValue('stars');
        const staffId = interaction.fields.getTextInputValue('staff_id').trim();
        const comment = interaction.fields.getTextInputValue('comment') || 'لا يوجد تعليق';

        const numStars = Number(stars);
        if (isNaN(numStars) || numStars < 1 || numStars > 5) {
          return interaction.reply({
            content: '❌ يجب أن يكون التقييم رقماً بين 1 و 5',
            flags: ['Ephemeral']
          });
        }

        const guild = interaction.client.guilds.cache.get(guildId);
        if (!guild) {
          return interaction.reply({
            content: '❌ تعذر العثور على السيرفر',
            flags: ['Ephemeral']
          });
        }

        const settings = db.getTicketSettings(guildId);
        const feedbackChannel = guild.channels.cache.get(settings.feedbacks_channel);

        if (!feedbackChannel) {
          return interaction.reply({
            content: '❌ روم التقييمات غير موجود',
            flags: ['Ephemeral']
          });
        }

        const embed = new EmbedBuilder()
          .setColor('#f59e0b')
          .setTitle('⭐ تقييم جديد')
          .addFields(
            {
              name: 'العضو',
              value: `${interaction.user} (${interaction.user.id})`,
              inline: true
            },
            {
              name: 'الإداري',
              value: `<@${staffId}> (${staffId})`,
              inline: true
            },
            {
              name: 'التقييم',
              value: '⭐'.repeat(numStars),
              inline: true
            },
            {
              name: 'التعليق',
              value: comment,
              inline: false
            }
          )
          .setTimestamp();

        await feedbackChannel.send({
          embeds: [embed]
        });

        await interaction.reply({
          content: '✅ شكراً على تقييمك',
          flags: ['Ephemeral']
        });
      }
    } catch (err) {
      logger.error('Unhandled interaction error:', err);
    }
  }
};
