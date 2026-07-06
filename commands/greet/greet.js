const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('إعداد رسائل الترحيب')
    .addChannelOption(o => o.setName('channel').setDescription('روم الترحيب').setRequired(true).addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const ch = interaction.options.getChannel('channel');
    const settings = db.getGreetSettings(interaction.guildId);

    db.db.prepare('UPDATE greet_settings SET channel = ?, enabled = 1 WHERE guildId = ?').run(ch.id, interaction.guildId);
    return interaction.reply({ embeds: [success(locale.get('greet.greetEnabled', { channel: ch }))] });
  }
};
