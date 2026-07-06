const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autotax')
    .setDescription('إعداد ضريبة تلقائية')
    .addChannelOption(o => o.setName('channel').setDescription('الروم للإعداد').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    const existing = db.getAutomation(interaction.guildId, channel.id).find(a => a.type === 'autotax');

    if (existing) {
      db.removeAutomation(interaction.guildId, channel.id, 'autotax');
      return interaction.reply({ embeds: [success('تعطيل الضريبة التلقائية', `تم تعطيل الضريبة التلقائية في ${channel}`)] });
    } else {
      db.addAutomation(interaction.guildId, channel.id, 'autotax', 'enabled');
      return interaction.reply({ embeds: [success('تفعيل الضريبة التلقائية', `تم تفعيل الضريبة التلقائية في ${channel}`)] });
    }
  }
};
