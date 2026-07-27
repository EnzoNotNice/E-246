const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetmsg')
    .setDescription('تحديد رسالة الترحيب وإعدادات الصورة')
    .addStringOption(o => o.setName('message').setDescription('نص رسالة الترحيب').setRequired(true))
    .addStringOption(o => o.setName('scale_mode').setDescription('وضع تحجيم الصورة').addChoices(
      { name: 'Fit (الحفاظ على النسبة)', value: 'fit' },
      { name: 'Cover (ملء الشاشة)', value: 'cover' },
      { name: 'Stretch (تمديد)', value: 'stretch' }
    ))
    .addIntegerOption(o => o.setName('avatar_x_mm').setDescription('موضع الصورة الرمزية أفقيًا (مليمتر)'))
    .addIntegerOption(o => o.setName('avatar_y_mm').setDescription('موضع الصورة الرمزية عموديًا (مليمتر)'))
    .addIntegerOption(o => o.setName('avatar_size_mm').setDescription('حجم الصورة الرمزية (مليمتر)'))
    .addIntegerOption(o => o.setName('username_x_mm').setDescription('موضع اسم المستخدم أفقيًا (مليمتر)'))
    .addIntegerOption(o => o.setName('username_y_mm').setDescription('موضع اسم المستخدم عموديًا (مليمتر)'))
    .addIntegerOption(o => o.setName('username_size_mm').setDescription('حجم اسم المستخدم (مليمتر)'))
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

      db.getGreetSettings(interaction.guildId);
      
      const updates = ['message = ?'];
      const values = [msg];
      
      if (scaleMode) {
        updates.push('image_scale_mode = ?');
        values.push(scaleMode);
      }
      if (avatarXMm !== null) {
        updates.push('avatar_x_mm = ?');
        values.push(avatarXMm);
      }
      if (avatarYMm !== null) {
        updates.push('avatar_y_mm = ?');
        values.push(avatarYMm);
      }
      if (avatarSizeMm !== null) {
        updates.push('avatar_size_mm = ?');
        values.push(avatarSizeMm);
      }
      if (usernameXMm !== null) {
        updates.push('username_x_mm = ?');
        values.push(usernameXMm);
      }
      if (usernameYMm !== null) {
        updates.push('username_y_mm = ?');
        values.push(usernameYMm);
      }
      if (usernameSizeMm !== null) {
        updates.push('username_size_mm = ?');
        values.push(usernameSizeMm);
      }
      
      values.push(interaction.guildId);
      
      db.db.prepare(`UPDATE greet_settings SET ${updates.join(', ')} WHERE guildId = ?`).run(...values);
      
      return interaction.reply({
        embeds: [success(locale.get('greet.messageSet'))]
      });
    
    } catch (err) {
      console.error('[Command Error - greetmsg.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
