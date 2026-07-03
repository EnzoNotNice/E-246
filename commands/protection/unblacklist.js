const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('إزالة عضو أو رتبة من القائمة السوداء للحماية')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد إزالته'))
    .addRoleOption(o => o.setName('role').setDescription('الرتبة المراد إزالتها'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    if (!user && !role) return interaction.reply({ embeds: [error(locale.get('general.noTarget'))], flags: ['Ephemeral'] });
    const target = user || role;
    const result = db.removeBlacklist(interaction.guildId, target.id);
    if (!result.changes) return interaction.reply({ embeds: [error(locale.get('general.notFound'))], flags: ['Ephemeral'] });
    return interaction.reply({ embeds: [success(locale.get('protection.unblacklisted', { target: user ? `<@${target.id}>` : `<@&${target.id}>` }))] });
  }
};
