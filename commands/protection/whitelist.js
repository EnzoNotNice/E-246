const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('إضافة عضو أو رتبة إلى القائمة البيضاء للحماية')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد إضافته للقائمة البيضاء'))
    .addRoleOption(o => o.setName('role').setDescription('الرتبة المراد إضافتها للقائمة البيضاء'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    if (!user && !role) return interaction.reply({ embeds: [error(locale.get('general.noTarget'))], flags: ['Ephemeral'] });

    const target = user || role;
    const type = user ? 'user' : 'role';
    db.addWhitelist(interaction.guildId, target.id, type);

    return interaction.reply({ embeds: [success(locale.get('protection.whitelisted', { target: user ? `<@${target.id}>` : `<@&${target.id}>` }))] });
  }
};
