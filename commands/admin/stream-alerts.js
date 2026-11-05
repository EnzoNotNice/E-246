const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');
const { resolveYouTubeChannelId, isValidYouTubeChannelId } = require('../../utils/youtubeResolve');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stream-alerts')
    .setDescription('إعداد وتكوين تنبيهات البث المباشر (Twitch, Kick, YouTube)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('إضافة تنبيه بث مباشر جديد')
        .addStringOption((o) =>
          o
            .setName('platform')
            .setDescription('منصة البث')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'Kick', value: 'kick' },
              { name: 'YouTube', value: 'youtube' }
            )
        )
        .addStringOption((o) =>
          o
            .setName('channel_name')
            .setDescription('اسم المستخدم على Twitch/Kick أو معرف قناة YouTube')
            .setRequired(true)
        )
        .addChannelOption((o) =>
          o
            .setName('discord_channel')
            .setDescription('الروم المراد إرسال التنبيه فيه')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('message')
            .setDescription('رسالة التنبيه (استخدم المتغيرات: {author}, {title}, {url}, {platform})')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('إزالة تنبيه بث مباشر')
        .addStringOption((o) =>
          o
            .setName('platform')
            .setDescription('منصة البث')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'Kick', value: 'kick' },
              { name: 'YouTube', value: 'youtube' }
            )
        )
        .addStringOption((o) =>
          o.setName('channel_name').setDescription('اسم القناة المراد إزالة تنبيهها').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('عرض جميع تنبيهات البث المباشر النشطة في السيرفر')),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      // ──────────────── SUBCOMMAND: ADD ────────────────
      if (sub === 'add') {
        const platform = interaction.options.getString('platform');
        const channelName = interaction.options.getString('channel_name').trim();
        const discordChannel = interaction.options.getChannel('discord_channel');
        const customMessage = interaction.options.getString('message');

        await interaction.deferReply();

        let resolvedId = channelName;
        if (platform === 'youtube') {
          if (!isValidYouTubeChannelId(channelName)) {
            const resolved = await resolveYouTubeChannelId(channelName);
            if (resolved) {
              resolvedId = resolved;
            }
          }
        } else {
          // Twitch and Kick use lowercase slugs
          resolvedId = channelName
            .toLowerCase()
            .replace(/^(https?:\/\/)?(www\.)?(twitch\.tv\/|kick\.com\/)/i, '')
            .replace(/\/$/, '');
        }

        const defaultMessages = {
          twitch: '🟣 **{author}** بث مباشر الآن على Twitch!\n{url}',
          kick: '🟢 **{author}** بث مباشر الآن على Kick!\n{url}',
          youtube: '🔴 مقطع / بث جديد من **{author}** على YouTube!\n{url}'
        };

        const finalMessage = customMessage || defaultMessages[platform];

        db.addSocialAlert(guildId, platform, discordChannel.id, resolvedId, finalMessage);

        const brandColors = {
          twitch: 0x9146ff,
          kick: 0x53fc18,
          youtube: 0xff0000
        };

        const embed = new EmbedBuilder()
          .setColor(brandColors[platform] || 0x5865f2)
          .setTitle(`📡 تم تفعيل تنبيهات ${platform.toUpperCase()} بنجاح`)
          .setDescription(
            `تم ضبط التنبيه التلقائي بنجاح:\n\n` +
              `• **المنصة:** \`${platform.toUpperCase()}\`\n` +
              `• **القناة المستهدفة:** \`${resolvedId}\`\n` +
              `• **روم التنبيهات:** <#${discordChannel.id}>\n` +
              `• **الرسالة:**\n${finalMessage}`
          )
          .setFooter({ text: 'E-246 Multi-Platform Stream Alerts' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ──────────────── SUBCOMMAND: REMOVE ────────────────
      if (sub === 'remove') {
        const platform = interaction.options.getString('platform');
        const channelName = interaction.options.getString('channel_name').trim().toLowerCase();

        const alerts = db.getSocialAlerts(guildId);
        const targetAlert = alerts.find((a) => a.platform === platform && a.socialId.toLowerCase() === channelName);

        if (!targetAlert) {
          return interaction.reply({
            content: `❌ لم يتم العثور على تنبيه نشط لمنصة \`${platform}\` بالقناة \`${channelName}\`.`,
            ephemeral: true
          });
        }

        db.removeSocialAlert(targetAlert.id, guildId);

        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('🗑️ تم إزالة تنبيه البث')
          .setDescription(`تم حذف تنبيه منصة \`${platform.toUpperCase()}\` للقناة \`${channelName}\` بنجاح.`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ──────────────── SUBCOMMAND: LIST ────────────────
      if (sub === 'list') {
        const alerts = db.getSocialAlerts(guildId);

        if (!alerts || alerts.length === 0) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('📡 تنبيهات البث المباشر')
                .setDescription(
                  'لا توجد أي تنبيهات بث مباشر مضافة في هذا السيرفر حالياً.\nأضف تنبيهاً عبر `/stream-alerts add`.'
                )
            ]
          });
        }

        const fields = alerts.slice(0, 25).map((a, i) => {
          const platformIcons = {
            twitch: '🟣 Twitch',
            kick: '🟢 Kick',
            youtube: '🔴 YouTube'
          };
          return {
            name: `${i + 1}. ${platformIcons[a.platform] || a.platform} — \`${a.socialId}\``,
            value: `• الروم: <#${a.channelId}>\n• معرف التنبيه: \`${a.id}\``,
            inline: true
          };
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`📡 تنبيهات البث المباشر في السيرفر (${alerts.length})`)
          .setDescription('قائمة القنوات المربوطة بتنبيهات البث المباشر التلقائية:')
          .addFields(fields)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error('[StreamAlerts Command Error]:', err);
      if (interaction.deferred) {
        return interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر.' });
      }
      return interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral: true }).catch(() => null);
    }
  }
};
