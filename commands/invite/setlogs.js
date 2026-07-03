const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('تحديد روم سجلات الدخول والخروج')
    .addChannelOption(o => o.setName('channel').setDescription('الروم المخصص لسجل الدخول والخروج').setRequired(true).addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const ch = interaction.options.getChannel('channel');
    db.db.prepare('INSERT INTO invite_logs (guildId, channelId) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET channelId = ?').run(interaction.guildId, ch.id, ch.id);
    return interaction.reply({ embeds: [success(locale.get('invites.logsSet', { channel: ch }))] });
  }
};
