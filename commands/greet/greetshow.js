const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const emojis = require('../../utils/emojis.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetshow')
    .setDescription('إعدادات ميزة الترحيب')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const s = db.getGreetSettings(interaction.guildId);
    
    const eInfo = emojis.infocircle || '{emoji:infocircle}';
    const eChart = emojis.chartpie || '{emoji:chartpie}';
    const eCheck = emojis.circlecheck || '{emoji:circlecheck}';
    const eX = emojis.circlex || '{emoji:circlex}';
    const eClock = emojis.clock || '{emoji:clock}';
    const eMessage = emojis.message || '{emoji:message}';
    const eMail = emojis.mail || '{emoji:mail}';

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
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
};
