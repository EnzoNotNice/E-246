const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const emojis = require('../../utils/emojis.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetshow')
    .setDescription('عرض إعدادات ميزة الترحيب الحالية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const s = db.getGreetSettings(interaction.guildId);
    
    const eInfo = emojis.infocircle || '<:infocircle:1519212235258335324>';
    const eChart = emojis.chartpie || '<:chartpie:1519212248479043634>';
    const eCheck = emojis.circlecheck || '<:circlecheck:1519212246876557413>';
    const eX = emojis.circlex || '<:circlex:1519212245559672914>';
    const eClock = emojis.clock || '<:clock:1519212244263632916>';
    const eMessage = emojis.message || '<:message:1519212228132208701>';
    const eMail = emojis.mail || '<:mail:1519212229445029971>';

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
