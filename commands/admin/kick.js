const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('طرد عضو من السيرفر')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد طرده').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('سبب الطرد'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

    if (!target) return interaction.reply({ embeds: [error(locale.get('general.userNotFound'))], flags: ['Ephemeral'] });
    if (!target.kickable) return interaction.reply({ embeds: [error(locale.get('moderation.cannotKick'))], flags: ['Ephemeral'] });
    if (interaction.user.id !== interaction.guild.ownerId && target.roles.highest.position >= interaction.member.roles.highest.position)
      return interaction.reply({ embeds: [error(locale.get('general.noPermission'))], flags: ['Ephemeral'] });

    try {
      await target.kick(reason);
    } catch (e) {
      return interaction.reply({ embeds: [error(locale.get('moderation.cannotKick'))], flags: ['Ephemeral'] });
    }

    const logEmbed = modlog('Member Kicked', { tag: target.user.tag, id: target.id }, interaction.user, reason);
    await sendLog(interaction.client, interaction.guildId, logEmbed, 'kick');

    return interaction.reply({ embeds: [success(locale.get('moderation.kickSuccess', { user: target.user.tag, reason }))] });
  }
};
