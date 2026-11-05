const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');
const emojis = require('../../utils/emojis.json');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('إعداد وتكوين رسائل وميزات الترحيب بالأعضاء الجدد')
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('تحديد روم إرسال رسائل الترحيب وتفعيلها')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('روم الترحيب')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('message')
        .setDescription('تحديد نص رسالة الترحيب وإعدادات صورة الترحيب')
        .addStringOption((o) => o.setName('text').setDescription('نص رسالة الترحيب').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('scale_mode')
            .setDescription('وضع تحجيم الصورة')
            .addChoices(
              { name: 'Fit (الحفاظ على النسبة)', value: 'fit' },
              { name: 'Cover (ملء الشاشة)', value: 'cover' },
              { name: 'Stretch (تمديد)', value: 'stretch' }
            )
        )
        .addIntegerOption((o) => o.setName('avatar_x').setDescription('موضع الصورة الرمزية أفقياً (ملم)'))
        .addIntegerOption((o) => o.setName('avatar_y').setDescription('موضع الصورة الرمزية عمودياً (ملم)'))
        .addIntegerOption((o) => o.setName('avatar_size').setDescription('حجم الصورة الرمزية (ملم)'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('dm')
        .setDescription('إعداد رسالة الترحيب التي تصل للعضو في الخاص')
        .addStringOption((o) => o.setName('text').setDescription('نص رسالة الخاص (اتركه فارغاً لتعطيله)'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('delay')
        .setDescription('تحديد وقت الحذف التلقائي لرسالة الترحيب')
        .addIntegerOption((o) =>
          o
            .setName('seconds')
            .setDescription('ثواني قبل الحذف (0 للتعطيل)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(300)
        )
    )
    .addSubcommand((sub) => sub.setName('show').setDescription('عرض إعدادات ميزة الترحيب الحالية'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('تعطيل ميزة الترحيب'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (sub === 'channel') {
        const ch = interaction.options.getChannel('channel');
        const settings = db.getGreetSettings(guildId) || { guildId };
        settings.channel = ch.id;
        settings.enabled = 1;
        db.updateGreetSettings(guildId, settings);
        return interaction.reply({ embeds: [success(locale.get('greet.greetEnabled', { channel: ch }))] });
      }

      if (sub === 'message') {
        const text = interaction.options.getString('text');
        const scaleMode = interaction.options.getString('scale_mode');
        const avatarX = interaction.options.getInteger('avatar_x');
        const avatarY = interaction.options.getInteger('avatar_y');
        const avatarSize = interaction.options.getInteger('avatar_size');

        const settings = db.getGreetSettings(guildId) || { guildId };
        settings.message = text;
        if (scaleMode !== null) settings.image_scale_mode = scaleMode;
        if (avatarX !== null) settings.avatar_x_mm = avatarX;
        if (avatarY !== null) settings.avatar_y_mm = avatarY;
        if (avatarSize !== null) settings.avatar_size_mm = avatarSize;

        db.updateGreetSettings(guildId, settings);
        return interaction.reply({ embeds: [success(locale.get('greet.messageSet', { message: text }))] });
      }

      if (sub === 'dm') {
        const text = interaction.options.getString('text') || null;
        const settings = db.getGreetSettings(guildId) || { guildId };
        settings.dm_message = text;
        db.updateGreetSettings(guildId, settings);
        return interaction.reply({
          embeds: [success(text ? locale.get('greet.dmMessageSet') : locale.get('greet.dmMessageDisabled'))]
        });
      }

      if (sub === 'delay') {
        const secs = interaction.options.getInteger('seconds');
        const settings = db.getGreetSettings(guildId) || { guildId };
        settings.delete_after = secs;
        db.updateGreetSettings(guildId, settings);
        return interaction.reply({
          embeds: [success(secs ? locale.get('greet.autoDeleteSet', { secs }) : locale.get('greet.autoDeleteDisabled'))]
        });
      }

      if (sub === 'disable') {
        const settings = db.getGreetSettings(guildId) || { guildId };
        settings.enabled = 0;
        db.updateGreetSettings(guildId, settings);
        return interaction.reply({ embeds: [success(locale.get('greet.greetDisabled'))] });
      }

      if (sub === 'show') {
        const s = db.getGreetSettings(guildId);
        const eInfo = emojis.infocircle || '{emoji:infocircle}';
        const eChart = emojis.chartpie || '{emoji:chartpie}';
        const eCheck = emojis.circlecheck || '{emoji:circlecheck}';
        const eX = emojis.circlex || '{emoji:circlex}';
        const eClock = emojis.clock || '{emoji:clock}';
        const eMessage = emojis.message || '{emoji:message}';
        const eMail = emojis.mail || '{emoji:mail}';

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`${eInfo} إعدادات الترحيب`)
          .addFields(
            { name: `${eChart} الحالة`, value: s.enabled ? `${eCheck} مفعّل` : `${eX} معطّل`, inline: true },
            { name: `${eInfo} الروم`, value: s.channel ? `<#${s.channel}>` : 'غير محدد', inline: true },
            { name: `${eClock} الحذف التلقائي`, value: s.delete_after ? `${s.delete_after}s` : 'أبداً', inline: true },
            { name: `${eMessage} رسالة الترحيب`, value: s.message || 'غير محدد' },
            { name: `${eMail} رسالة خاصة`, value: s.dm_message || 'غير محدد' }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error('[Command Error - greet.js]:', err);
      if (interaction) {
        const replyPayload = { content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload).catch(() => null);
        } else {
          await interaction.reply(replyPayload).catch(() => null);
        }
      }
    }
  }
};
