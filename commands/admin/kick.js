const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('طرد عضو')
    .addUserOption((o) => o.setName('user').setDescription('العضو للطرد').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('سبب الطرد'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [error(locale.get('general.noPermission'))], flags: ['Ephemeral'] });
    }

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

    if (!target)
      return interaction.reply({ embeds: [error(locale.get('general.userNotFound'))], flags: ['Ephemeral'] });
    if (!target.kickable)
      return interaction.reply({ embeds: [error(locale.get('moderation.cannotKick'))], flags: ['Ephemeral'] });
    if (
      interaction.user.id !== interaction.guild.ownerId &&
      target.roles.highest.position >= interaction.member.roles.highest.position
    )
      return interaction.reply({ embeds: [error(locale.get('general.noPermission'))], flags: ['Ephemeral'] });

    try {
      await target.kick(reason);
      db.addModAction(
        interaction.guildId,
        target.id,
        target.user.tag,
        interaction.user.id,
        interaction.user.tag,
        'kick',
        reason
      );
    } catch (e) {
      return interaction
        .reply({ embeds: [error(locale.get('moderation.cannotKick'))], flags: ['Ephemeral'] })
        .catch(() => {});
    }

    const logEmbed = modlog('Member Kicked', { tag: target.user.tag, id: target.id }, interaction.user, reason);
    await sendLog(interaction.client, interaction.guildId, logEmbed, 'kick');

    return interaction
      .reply({ embeds: [success(locale.get('moderation.kickSuccess', { user: target.user.tag, reason }))] })
      .catch(() => {});
  }
};
