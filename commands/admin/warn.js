const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('تحذير عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو للتحذير').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('سبب التحذير').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    if (!target) return interaction.reply({ embeds: [error(locale.get('general.userNotFound'))], flags: ['Ephemeral'] });

    await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

    db.addWarning(target.id, interaction.guildId, reason, interaction.user.id);
    const warnings = db.getWarnings(target.id, interaction.guildId);

    await target.user.send({
      embeds: [
        error(locale.get('moderation.dmWarned', { server: interaction.guild.name, reason, total: warnings.length }))
      ]
    }).catch(() => null);

    const logEmbed = modlog('تم تحذير العضو', { tag: target.user.tag, id: target.id }, interaction.user, reason, { '{emoji:alerttriangle} إجمالي التحذيرات': String(warnings.length) });
    await sendLog(interaction.client, interaction.guildId, logEmbed, 'warn');

    return interaction.editReply({
      embeds: [success(locale.get('moderation.warnSuccess', { user: target.user.tag, reason, total: warnings.length }))]
    });
  }
};
