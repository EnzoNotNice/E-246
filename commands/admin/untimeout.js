const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('رفع الإسكات عن عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد رفع الإسكات عنه').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

    if (!target) return interaction.reply({ embeds: [error(locale.get('general.userNotFound'))], flags: ['Ephemeral'] });
    if (!target.isCommunicationDisabled()) return interaction.reply({ embeds: [error(locale.get('moderation.notTimedOut'))], flags: ['Ephemeral'] });

    await target.timeout(null, reason);

    const logEmbed = modlog('تم رفع الإسكات', { tag: target.user.tag, id: target.id }, interaction.user, reason);
    await sendLog(interaction.client, interaction.guildId, logEmbed, 'timeout');

    return interaction.reply({ embeds: [success(locale.get('moderation.untimeoutSuccess', { user: target.user.tag }))] });
  }
};
