const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetinvites')
    .setDescription("تصفير دعوات عضو أو الكل")
    .addUserOption(o => o.setName('user').setDescription("العضو المراد تصفير دعواته اتركه فارغاً لتصفير الكل"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const user = interaction.options.getUser('user');

    if (user) {
      db.resetInvites(user.id, interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('invites.userReset', { user: user.tag }))] });
    }

    db.resetAllInvites(interaction.guildId);
    return interaction.reply({ embeds: [success(locale.get('invites.serverReset'))] });
  }
};
