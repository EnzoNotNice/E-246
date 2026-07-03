const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoline')
    .setDescription('تفعيل أو تعطيل الخط التلقائي لروم محدد')
    .addChannelOption(o => o.setName('channel').setDescription('الروم المراد إعداده').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    const existing = db.getAutomation(interaction.guildId, channel.id).find(a => a.type === 'autoline');

    if (existing) {
      db.removeAutomation(interaction.guildId, channel.id, 'autoline');
      return interaction.reply({ embeds: [success('تعطيل الفاصل التلقائي', `تم تعطيل الفاصل التلقائي في ${channel}`)] });
    } else {
      db.addAutomation(interaction.guildId, channel.id, 'autoline', 'enabled');
      return interaction.reply({ embeds: [success('تفعيل الفاصل التلقائي', `تم تفعيل الفاصل التلقائي في ${channel}`)] });
    }
  }
};
