const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('فتح الروم')
    .addChannelOption(o => o.setName('channel').setDescription('الروم للفتح').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('reason').setDescription('سبب الفتح'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }, { reason });

    return interaction.reply({
      embeds: [success(locale.get('moderation.unlockSuccess', { channel, reason }))]
    });
  }
};
