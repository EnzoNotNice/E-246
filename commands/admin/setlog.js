const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('روم السجلات الرئيسي')
    .addChannelOption(o => o.setName('channel').setDescription('روم السجلات').setRequired(true).addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const ch = interaction.options.getChannel('channel');
    db.setLogChannel(interaction.guildId, ch.id);
    db.setGuildSetting(interaction.guildId, 'setlog_channel', ch.id);
    return interaction.reply({ embeds: [success(locale.get('moderation.mainLogSet', { channel: ch }))] });
  }
};
