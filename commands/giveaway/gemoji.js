const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gemoji')
    .setDescription('إيموجي القيف اواي')
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي القيف اواي').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const emoji = interaction.options.getString('emoji');
    db.setGuildSetting(interaction.guildId, 'giveaway_emoji', emoji);
    return interaction.reply({ embeds: [success(locale.get('giveaway.emojiSet', { emoji }))] });
  }
};
