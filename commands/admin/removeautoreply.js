const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeautoreply')
    .setDescription('حذف رد تلقائي')
    .addStringOption(o => o.setName('trigger').setDescription('عبارة التشغيل المراد حذفها').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const trigger = interaction.options.getString('trigger').toLowerCase();
    const result = db.removeAutoReply(interaction.guildId, trigger);

    if (!result.changes) return interaction.reply({ embeds: [error(locale.get('general.notFound'))], flags: ['Ephemeral'] });

    return interaction.reply({ embeds: [success(locale.get('moderation.autoReplyRemoved', { trigger }))] });
  }
};
