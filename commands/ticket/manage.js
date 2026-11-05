const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const fs = require('fs');
const path = require('path');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('إدارة التذاكر ونظام الدعم الفني المتقدم')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('إضافة عضو للتذكرة الحالية')
        .addUserOption((o) => o.setName('member').setDescription('العضو للإضافة').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('إزالة عضو من التذكرة الحالية')
        .addUserOption((o) => o.setName('member').setDescription('العضو للإزالة').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('تغيير اسم قناة التذكرة')
        .addStringOption((o) => o.setName('name').setDescription('الاسم الجديد للتذكرة').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('claim').setDescription('استلام التذكرة وقفل الردود لطاقم الدعم الآخرين'))
    .addSubcommand((sub) => sub.setName('unclaim').setDescription('إلغاء استلام التذكرة وإتاحتها لجميع المشرفين'))
    .addSubcommand((sub) =>
      sub
        .setName('priority')
        .setDescription('تحديد مستوى أولوية التذكرة')
        .addStringOption((o) =>
          o
            .setName('level')
            .setDescription('مستوى الأولوية')
            .setRequired(true)
            .addChoices(
              { name: '🟢 منخفض (Low)', value: 'low' },
              { name: '🟡 عادي (Normal)', value: 'normal' },
              { name: '🔴 عاجل وحرج (Urgent)', value: 'urgent' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('transfer')
        .setDescription('تحويل التذكرة إلى قسم آخر')
        .addStringOption((o) =>
          o.setName('department').setDescription('اسم القسم المراد التحويل إليه').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('close').setDescription('إغلاق التذكرة وأرشفتها مع تفريغ الويب واستطلاع التقييم')
    )
    .addSubcommand((sub) =>
      sub.setName('stats').setDescription('عرض تحليلات أداء الدعم الفني وسرعة الاستجابة والتقييمات')
    )
    .addSubcommandGroup((grp) =>
      grp
        .setName('canned')
        .setDescription('إدارة واستخدام الردود السريعة الجاهزة')
        .addSubcommand((sub) =>
          sub
            .setName('send')
            .setDescription('إرسال رد سريع جاهز داخل التذكرة')
            .addStringOption((o) => o.setName('name').setDescription('اسم الرد الجاهز').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('إضافة رد سريع جاهز جديد')
            .addStringOption((o) => o.setName('name').setDescription('اسم أو اختصار الرد').setRequired(true))
            .addStringOption((o) => o.setName('content').setDescription('نص الرد الكامل').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('حذف رد سريع جاهز')
            .addStringOption((o) => o.setName('name').setDescription('اسم الرد').setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('عرض قائمة بجميع الردود الجاهزة المسجلة'))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {
      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      // Global or non-channel specific subcommands
      if (sub === 'stats') {
        const analytics = db.getTicketAnalytics(guildId);
        const ratings = db.getTicketRatings(guildId);
        const openTickets = db.getOpenTickets().filter((t) => t.guildId === guildId);

        const avgSec = analytics.avgFirstResponseSeconds;
        let responseTimeText = 'لا توجد بيانات كافية';
        if (avgSec > 0) {
          if (avgSec < 60) responseTimeText = `${avgSec} ثانية`;
          else if (avgSec < 3600) responseTimeText = `${Math.round(avgSec / 60)} دقيقة`;
          else responseTimeText = `${(avgSec / 3600).toFixed(1)} ساعة`;
        }

        const statsEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📊 تحليلات وإحصائيات أداء الدعم الفني')
          .addFields(
            { name: '🎫 إجمالي التذاكر', value: `${analytics.totalTickets} تذكرة`, inline: true },
            { name: '📂 التذاكر المفتوحة حالياً', value: `${openTickets.length} تذكرة`, inline: true },
            { name: '🔒 التذاكر المغلقة', value: `${analytics.closedTickets} تذكرة`, inline: true },
            { name: '⚡ متوسط سرعة الاستجابة', value: responseTimeText, inline: true },
            {
              name: '⭐ متوسط التقييم (CSAT)',
              value: `${analytics.averageRating} / 5 (${ratings.length} تقييم)`,
              inline: true
            }
          )
          .setFooter({ text: 'نظام التذاكر المتقدم' })
          .setTimestamp();

        return interaction.reply({ embeds: [statsEmbed] });
      }

      // Canned subcommands (can manage anywhere or send in ticket)
      if (group === 'canned') {
        if (sub === 'add') {
          const name = interaction.options.getString('name').trim();
          const content = interaction.options.getString('content').trim();
          await db.addCannedResponse(guildId, name, content, interaction.user.id);
          return interaction.reply({
            embeds: [success(`تمت إضافة الرد السريع **${name}** بنجاح`)],
            flags: ['Ephemeral']
          });
        }

        if (sub === 'remove') {
          const name = interaction.options.getString('name').trim();
          await db.removeCannedResponse(guildId, name);
          return interaction.reply({
            embeds: [success(`تم حذف الرد السريع **${name}** بنجاح`)],
            flags: ['Ephemeral']
          });
        }

        if (sub === 'list') {
          const list = db.getCannedResponses(guildId);
          if (!list.length) {
            return interaction.reply({
              embeds: [error('لا توجد ردود سريعة مسجلة في هذا السيرفر')],
              flags: ['Ephemeral']
            });
          }

          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('💬 قائمة الردود السريعة الجاهزة')
            .setDescription(
              list
                .map(
                  (c, i) =>
                    `**${i + 1}. \`${c.name}\`**\n> ${c.content.length > 80 ? c.content.slice(0, 80) + '...' : c.content}`
                )
                .join('\n\n')
            );

          return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
        }

        if (sub === 'send') {
          const name = interaction.options.getString('name').trim();
          const canned = db.getCannedResponse(guildId, name);
          if (!canned) {
            return interaction.reply({
              embeds: [error(`لم يتم العثور على رد سريع باسم \`${name}\``)],
              flags: ['Ephemeral']
            });
          }

          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: `${interaction.user.username} (دعم فني)`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(canned.content)
            .setFooter({ text: `📌 رد جاهز: ${canned.name}` });

          await interaction.channel.send({ embeds: [embed] });
          return interaction.reply({ content: `✅ تم إرسال الرد السريع \`${canned.name}\``, flags: ['Ephemeral'] });
        }
      }

      // The remaining subcommands require an active ticket channel
      const ticket = db.getTicketByChannel(interaction.channelId);
      if (!ticket) {
        return interaction.reply({
          embeds: [error('يجب تشغيل هذا الأمر داخل قناة تذكرة نشطة')],
          flags: ['Ephemeral']
        });
      }

      if (sub === 'add') {
        const member = interaction.options.getMember('member');
        if (!member) {
          return interaction.reply({ embeds: [error('العضو غير موجود في السيرفر')], flags: ['Ephemeral'] });
        }

        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true
        });

        return interaction.reply({ embeds: [success(`تمت إضافة <@${member.id}> إلى التذكرة بنجاح`)] });
      }

      if (sub === 'remove') {
        const member = interaction.options.getMember('member');
        if (!member) {
          return interaction.reply({ embeds: [error('العضو غير موجود في السيرفر')], flags: ['Ephemeral'] });
        }

        if (member.id === ticket.userId) {
          return interaction.reply({ embeds: [error('لا يمكن إزالة صاحب التذكرة الأصلي')], flags: ['Ephemeral'] });
        }

        await interaction.channel.permissionOverwrites.delete(member.id);
        return interaction.reply({ embeds: [success(`تمت إزالة <@${member.id}> من التذكرة بنجاح`)] });
      }

      if (sub === 'rename') {
        const name = interaction.options.getString('name');
        await interaction.channel.setName(name);
        return interaction.reply({ embeds: [success(`تم تغيير اسم التذكرة إلى \`${name}\` بنجاح`)] });
      }

      if (sub === 'claim') {
        if (ticket.claimedBy) {
          return interaction.reply({
            embeds: [error(`التذكرة مستلمة بالفعل بواسطة <@${ticket.claimedBy}>`)],
            flags: ['Ephemeral']
          });
        }

        const settings = db.getTicketSettings(guildId);
        const staffRole = ticket.departmentRole || settings.staff_role;

        db.claimTicket(interaction.channelId, interaction.user.id);

        if (staffRole) {
          await interaction.channel.permissionOverwrites
            .edit(staffRole, {
              SendMessages: false
            })
            .catch(() => null);
        }

        await interaction.channel.permissionOverwrites
          .edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true
          })
          .catch(() => null);

        return interaction.reply({
          embeds: [success(`تم استلام التذكرة وقفل الردود للمشرف ${interaction.user} بنجاح`)]
        });
      }

      if (sub === 'unclaim') {
        if (!ticket.claimedBy) {
          return interaction.reply({
            embeds: [error('التذكرة غير مستلمة حالياً')],
            flags: ['Ephemeral']
          });
        }

        const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (ticket.claimedBy !== interaction.user.id && !isAdmin) {
          return interaction.reply({
            embeds: [error('فقط المشرف المستلم أو الإدارة يمكنهم إلغاء الاستلام')],
            flags: ['Ephemeral']
          });
        }

        const settings = db.getTicketSettings(guildId);
        const staffRole = ticket.departmentRole || settings.staff_role;

        db.unclaimTicket(interaction.channelId);

        if (staffRole) {
          await interaction.channel.permissionOverwrites
            .edit(staffRole, {
              SendMessages: true
            })
            .catch(() => null);
        }

        return interaction.reply({
          embeds: [success(`تم إلغاء استلام التذكرة وأصبحت مفتوحة للردود من قبل جميع المشرفين`)]
        });
      }

      if (sub === 'priority') {
        const level = interaction.options.getString('level');
        db.updateTicketPriority(interaction.channelId, level);

        const map = {
          low: '🟢 منخفض (Low)',
          normal: '🟡 عادي (Normal)',
          urgent: '🔴 عاجل وحرج (Urgent)'
        };
        const label = map[level] || level;

        return interaction.reply({
          embeds: [success(`تم تحديث أولوية التذكرة إلى: **${label}**`)]
        });
      }

      if (sub === 'transfer') {
        const deptName = interaction.options.getString('department').trim();
        const categories = db.getTicketCategories(guildId) || [];
        const targetCat = categories.find((c) => c.name.toLowerCase() === deptName.toLowerCase());

        if (!targetCat) {
          const available = categories.map((c) => `\`${c.name}\``).join(', ') || 'لا توجد أقسام مسجلة';
          return interaction.reply({
            embeds: [error(`لم يتم العثور على القسم \`${deptName}\`.\nالأقسام المتاحة: ${available}`)],
            flags: ['Ephemeral']
          });
        }

        const oldDeptRole = ticket.departmentRole;
        const newDeptRole = targetCat.staffRoleId || targetCat.staff_role;
        const targetParentId = targetCat.categoryId || targetCat.category_id;

        if (targetParentId) {
          await interaction.channel.setParent(targetParentId, { lockPermissions: false }).catch(() => null);
        }

        if (oldDeptRole && oldDeptRole !== newDeptRole) {
          await interaction.channel.permissionOverwrites.delete(oldDeptRole).catch(() => null);
        }
        if (newDeptRole) {
          await interaction.channel.permissionOverwrites
            .edit(newDeptRole, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              AttachFiles: true
            })
            .catch(() => null);
        }

        db.updateTicketDepartment(interaction.channelId, targetCat.name, newDeptRole);

        return interaction.reply({
          embeds: [success(`تم تحويل التذكرة إلى قسم **${targetCat.name}** بنجاح`)]
        });
      }

      if (sub === 'close') {
        await interaction.reply({
          content: '🔒 جاري حفظ تفريغ المحادثة وإغلاق التذكرة خلال 5 ثواني...'
        });

        const settings = await db.getTicketSettings(guildId);
        let htmlString = '';
        let attachment = null;

        try {
          htmlString = await discordTranscripts.createTranscript(interaction.channel, {
            limit: -1,
            returnType: 'string'
          });
          if (htmlString) {
            attachment = new AttachmentBuilder(Buffer.from(htmlString, 'utf-8'), {
              name: `transcript-${interaction.channel.id}.html`
            });
          }
        } catch (err) {
          logger.error('[Transcript Error in /ticket close]:', err);
        }

        const transcriptsDir = path.join(__dirname, '..', '..', 'dashboard', 'public', 'transcripts');
        if (!fs.existsSync(transcriptsDir)) {
          fs.mkdirSync(transcriptsDir, { recursive: true });
        }
        if (htmlString) {
          fs.writeFileSync(path.join(transcriptsDir, `${interaction.channel.id}.html`), htmlString, 'utf8');
          await db.saveWebTranscript(interaction.channel.id, guildId, ticket.userId, htmlString);
        }

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const webUrl = `${baseUrl}/transcripts/${interaction.channel.id}`;

        const logCh = interaction.guild.channels.cache.get(settings.log_channel);
        if (logCh) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('{emoji:circlex} Ticket Closed')
            .setDescription(
              `**صاحب التذكرة:** <@${ticket.userId}>\n` +
                `**أغلقت بواسطة:** ${interaction.user}\n` +
                `**القسم:** \`${ticket.department || 'عام'}\`\n` +
                `**الأولوية:** \`${ticket.priority || 'عادي'}\`\n` +
                `**رابط التفريغ:** [عرض تفريغ التذكرة عبر الويب](${webUrl})`
            )
            .setTimestamp();

          await logCh.send({ embeds: [logEmbed], files: attachment ? [attachment] : [] }).catch(() => null);
        }

        const ticketOwner = await interaction.client.users.fetch(ticket.userId).catch(() => null);
        if (ticketOwner) {
          const starsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`rate_star_${guildId}_${ticket.channelId}_1`)
              .setLabel('1 ⭐')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`rate_star_${guildId}_${ticket.channelId}_2`)
              .setLabel('2 ⭐')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`rate_star_${guildId}_${ticket.channelId}_3`)
              .setLabel('3 ⭐')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`rate_star_${guildId}_${ticket.channelId}_4`)
              .setLabel('4 ⭐')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`rate_star_${guildId}_${ticket.channelId}_5`)
              .setLabel('5 ⭐')
              .setStyle(ButtonStyle.Success)
          );

          const dmEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🌟 تم إغلاق تذكرتك بنجاح')
            .setDescription(
              `شكراً لتواصلك مع الدعم في سيرفر **${interaction.guild.name}**.\n\n` +
                `🌐 **رابط تفريغ المحادثة على الويب:**\n[انقر هنا لمشاهدة تفريغ التذكرة](${webUrl})\n\n` +
                `**يرجى تقييم مستوى الخدمة المقدمة باختيار عدد النجوم أدناه:**`
            )
            .setFooter({ text: 'تقييمك يساعدنا في تحسين جودة الخدمة دائماً' });

          await ticketOwner.send({ embeds: [dmEmbed], components: [starsRow] }).catch(() => null);
        }

        const channelId = interaction.channelId;
        db.closeTicket(channelId);

        setTimeout(async () => {
          try {
            const channel = interaction.guild?.channels?.cache?.get(channelId);
            if (channel) await channel.delete().catch(() => null);
          } catch (err) {
            logger.error('[Ticket Close Timeout Error]:', err);
          }
        }, 5000);
      }
    } catch (err) {
      logger.error('[Command Error - manage.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
