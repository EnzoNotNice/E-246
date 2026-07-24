const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error, modlog } = require('../../utils/embeds');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('رفع الحظر')
    .addStringOption(o => o.setName('user_id').setDescription('معرف العضو'))
    .addStringOption(o => o.setName('reason').setDescription('سبب رفع الحظر'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    try {  
      await interaction.deferReply();
      const userId = interaction.options.getString('user_id');
      const reason = interaction.options.getString('reason') || 'لا يوجد سبب';
  
      if (!userId) {
        const bans = await interaction.guild.bans.fetch();
        if (bans.size === 0) return interaction.editReply({ embeds: [error(locale.get('moderation.noBans'))] });
  
        let count = 0;
        for (const [, ban] of bans) {
          await interaction.guild.members.unban(ban.user, reason).catch(() => null);
          count++;
        }
        const logEmbed = modlog('رفع حظر جماعي', { tag: `${count} عضو`, id: 'غير متاح' }, interaction.user, reason);
        await sendLog(interaction.client, interaction.guildId, logEmbed, 'unban');
        return interaction.editReply({ embeds: [success(locale.get('moderation.massUnbanSuccess', { count }))] });
      }
  
      const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!ban) return interaction.editReply({ embeds: [error(locale.get('moderation.notBanned'))] });
  
      await interaction.guild.members.unban(userId, reason);
      const logEmbed = modlog('تم رفع الحظر', { tag: ban.user.tag, id: ban.user.id }, interaction.user, reason);
      await sendLog(interaction.client, interaction.guildId, logEmbed, 'unban');
  
      return interaction.editReply({ embeds: [success(locale.get('moderation.unbanSuccess', { user: ban.user.tag }))] });
    
    } catch (err) {
      console.error('[Command Error - unban.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
