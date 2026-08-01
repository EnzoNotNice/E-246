const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetmsg')
    .setDescription('تحديد رسالة الترحيب وإعدادات الصورة')
    .addStringOption((o) => o.setName('message').setDescription('نص رسالة الترحيب').setRequired(true))
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
    .addIntegerOption((o) => o.setName('avatar_x_mm').setDescription('موضع الصورة الرمزية أفقيًا (مليمتر)'))
    .addIntegerOption((o) => o.setName('avatar_y_mm').setDescription('موضع الصورة الرمزية عموديًا (مليمتر)'))
    .addIntegerOption((o) => o.setName('avatar_size_mm').setDescription('حجم الصورة الرمزية (مليمتر)'))
    .addIntegerOption((o) => o.setName('username_x_mm').setDescription('موضع اسم المستخدم أفقيًا (مليمتر)'))
    .addIntegerOption((o) => o.setName('username_y_mm').setDescription('موضع اسم المستخدم عموديًا (مليمتر)'))
    .addIntegerOption((o) => o.setName('username_size_mm').setDescription('حجم اسم المستخدم (مليمتر)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const msg = interaction.options.getString('message');
      const scaleMode = interaction.options.getString('scale_mode');
      const avatarXMm = interaction.options.getInteger('avatar_x_mm');
      const avatarYMm = interaction.options.getInteger('avatar_y_mm');
      const avatarSizeMm = interaction.options.getInteger('avatar_size_mm');
      const usernameXMm = interaction.options.getInteger('username_x_mm');
      const usernameYMm = interaction.options.getInteger('username_y_mm');
      const usernameSizeMm = interaction.options.getInteger('username_size_mm');

      const settings = db.getGreetSettings(interaction.guildId) || { guildId: interaction.guildId };

      settings.message = msg;
      if (scaleMode !== null) settings.image_scale_mode = scaleMode;
      if (avatarXMm !== null) settings.avatar_x_mm = avatarXMm;
      if (avatarYMm !== null) settings.avatar_y_mm = avatarYMm;
      if (avatarSizeMm !== null) settings.avatar_size_mm = avatarSizeMm;
      if (usernameXMm !== null) settings.username_x_mm = usernameXMm;
      if (usernameYMm !== null) settings.username_y_mm = usernameYMm;
      if (usernameSizeMm !== null) settings.username_size_mm = usernameSizeMm;

      db.updateGreetSettings(interaction.guildId, settings);

      return interaction.reply({
        embeds: [success(locale.get('greet.messageSet'))]
      });
    } catch (err) {
      logger.error('[Command Error - greetmsg.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
