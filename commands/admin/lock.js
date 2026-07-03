const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('منع @everyone من إرسال الرسائل في روم محدد')
    .addChannelOption(o => o.setName('channel').setDescription('الروم المراد قفله الافتراضي الروم الحالي').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('reason').setDescription('سبب القفل'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason });

    return interaction.reply({
      embeds: [success(locale.get('moderation.lockSuccess', { channel, reason }))]
    });
  }
};
