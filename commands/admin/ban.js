const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('حظر عضو من السيرفر')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد حظره').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('سبب الحظر'))
    .addIntegerOption(o => o.setName('delete_messages').setDescription('عدد أيام الرسائل المراد حذفها من 0 إلى 7').setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';
    const deleteDays = interaction.options.getInteger('delete_messages') ?? 0;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!target) return interaction.reply({ embeds: [error(locale.get('general.userNotFound'))], flags: ['Ephemeral'] });
    if (member && !member.bannable) return interaction.reply({ embeds: [error(locale.get('moderation.cannotBan'))], flags: ['Ephemeral'] });
    if (interaction.user.id !== interaction.guild.ownerId && member && member.roles.highest.position >= interaction.member.roles.highest.position)
      return interaction.reply({ embeds: [error(locale.get('general.noPermission'))], flags: ['Ephemeral'] });

    try {
      await interaction.guild.members.ban(target, { reason, deleteMessageSeconds: deleteDays * 86400 });

      const logEmbed = modlog('Member Banned', { tag: target.tag, id: target.id }, interaction.user, reason);
      await sendLog(interaction.client, interaction.guildId, logEmbed, 'ban');

      return interaction.reply({
        embeds: [success(locale.get('moderation.banSuccess', { user: target.tag, reason }))]
      });
    } catch (e) {
      return interaction.reply({ embeds: [error(locale.get('general.errorOccurred'))], flags: ['Ephemeral'] });
    }
  }
};
