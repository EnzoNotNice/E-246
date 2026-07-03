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
      .setTitle('<:shield:1519212202676977788> تم تحديث حدود الحماية')
      .addFields(
        { name: '<:shieldlock:1519212205638287522> حد الباند', value: String(ban ?? prot.ban_limit), inline: true },
        { name: '<:circlex:1519212245559672914> حد الطرد', value: String(kick ?? prot.kick_limit), inline: true },
        { name: '<:folder:1519212238160924692> حد القنوات', value: String(channel ?? prot.channel_limit), inline: true },
        { name: '<:user:1519212186633764995> حد الرتب', value: String(role ?? prot.role_limit), inline: true },
        { name: '<:settings:1519212212227407953> حد الويب هوك', value: String(webhook ?? prot.webhook_limit), inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
