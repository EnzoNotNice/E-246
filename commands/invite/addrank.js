const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addrank')
    .setDescription('إعداد رتب الدعوات')
    .addIntegerOption(o => o.setName('count').setDescription('عدد الدعوات المطلوبة').setRequired(true).setMinValue(1))
    .addRoleOption(o => o.setName('role').setDescription('الرتبة الممنوحة').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const count = interaction.options.getInteger('count');
    const role = interaction.options.getRole('role');

    if (role.position >= interaction.guild.members.me.roles.highest.position)
      return interaction.reply({ embeds: [error(locale.get('general.botRoleTooLow'))], flags: ['Ephemeral'] });

    db.addInviteRank(interaction.guildId, count, role.id);
    return interaction.reply({ embeds: [success(locale.get('invites.rankAdded', { count, role }))] });
  }
};
