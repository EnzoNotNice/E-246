const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetshow')
    .setDescription('عرض إعدادات ميزة الترحيب الحالية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const s = db.getGreetSettings(interaction.guildId);
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('<:infocircle:1519212235258335324> إعدادات الترحيب')
      .addFields(
        { name: '<:chartpie:1519212248479043634> الحالة', value: s.enabled ? '<:circlecheck:1519212246876557413> مفعّل' : '<:circlex:1519212245559672914> معطّل', inline: true },
        { name: '<:infocircle:1519212235258335324> الروم', value: s.channel ? `<#${s.channel}>` : 'غير محدد', inline: true },
        { name: '<:clock:1519212244263632916> الحذف التلقائي', value: s.delete_after ? `${s.delete_after}s` : 'أبداً', inline: true },
        { name: '<:message:1519212228132208701> رسالة الترحيب', value: s.message || 'غير محدد' },
        { name: '<:mail:1519212229445029971> رسالة خاصة', value: s.dm_message || 'غير محدد' }
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
};
