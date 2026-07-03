const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('إسكات عضو ومنعه من إرسال الرسائل والتفاعل ودخول الرومات الصوتية')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد إسكاته').setRequired(true))
    .addIntegerOption(o => o.setName('duration').setDescription('المدة بالدقائق').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('سبب الإسكات'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

    if (!target) return interaction.reply({ embeds: [error(locale.get('general.userNotFound'))], flags: ['Ephemeral'] });
    if (!target.moderatable) return interaction.reply({ embeds: [error(locale.get('moderation.cannotTimeout'))], flags: ['Ephemeral'] });

    await target.timeout(duration * 60 * 1000, reason);

    const logEmbed = modlog('تم إسكات العضو', { tag: target.user.tag, id: target.id }, interaction.user, reason, { '<:clock:1519212244263632916> المدة': `${duration} دقيقة` });
    await sendLog(interaction.client, interaction.guildId, logEmbed, 'timeout');

    return interaction.reply({
      embeds: [success(locale.get('moderation.timeoutSuccess', { user: target.user.tag, time: duration + ' دقيقة', reason }))]
    });
  }
};
