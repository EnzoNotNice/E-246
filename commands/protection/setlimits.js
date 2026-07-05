const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlimits')
    .setDescription('تحديد حدود نظام الحماية')
    .addIntegerOption(o => o.setName('ban').setDescription('الحد الأقصى للباندات في 10 ثوانٍ').setMinValue(1).setMaxValue(20))
    .addIntegerOption(o => o.setName('kick').setDescription('الحد الأقصى للكيكات في 10 ثوانٍ').setMinValue(1).setMaxValue(20))
    .addIntegerOption(o => o.setName('channel').setDescription('الحد الأقصى لعمليات الروومات في 10 ثوانٍ').setMinValue(1).setMaxValue(20))
    .addIntegerOption(o => o.setName('role').setDescription('الحد الأقصى لعمليات الرتب في 10 ثوانٍ').setMinValue(1).setMaxValue(20))
    .addIntegerOption(o => o.setName('webhook').setDescription('الحد الأقصى لعمليات الويب هوك في 10 ثوانٍ').setMinValue(1).setMaxValue(20))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const ban = interaction.options.getInteger('ban');
    const kick = interaction.options.getInteger('kick');
    const channel = interaction.options.getInteger('channel');
    const role = interaction.options.getInteger('role');
    const webhook = interaction.options.getInteger('webhook');

    const prot = db.getProtection(interaction.guildId);
    const updates = {};
    if (ban !== null) updates.ban_limit = ban;
    if (kick !== null) updates.kick_limit = kick;
    if (channel !== null) updates.channel_limit = channel;
    if (role !== null) updates.role_limit = role;
    if (webhook !== null) updates.webhook_limit = webhook;

    for (const [key, val] of Object.entries(updates)) {
      db.db.prepare(`UPDATE protection_settings SET ${key} = ? WHERE guildId = ?`).run(val, interaction.guildId);
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('{emoji:shield} تم تحديث حدود الحماية')
      .addFields(
        { name: '{emoji:shieldlock} حد الباند', value: String(ban ?? prot.ban_limit), inline: true },
        { name: '{emoji:circlex} حد الطرد', value: String(kick ?? prot.kick_limit), inline: true },
        { name: '{emoji:folder} حد القنوات', value: String(channel ?? prot.channel_limit), inline: true },
        { name: '{emoji:user} حد الرتب', value: String(role ?? prot.role_limit), inline: true },
        { name: '{emoji:settings} حد الويب هوك', value: String(webhook ?? prot.webhook_limit), inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
