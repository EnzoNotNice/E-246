const { SlashCommandBuilder } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('تفعيل وضع الخمول / عدم الاتصال')
    .addStringOption((o) => o.setName('reason').setDescription('سبب الخمول').setRequired(false)),

  async execute(interaction) {
    try {
      const reason = interaction.options.getString('reason') || 'خارج الخدمة حالياً';
      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      db.setAFK(interaction.guildId, interaction.user.id, reason);

      // Attempt to change nickname
      const oldName = interaction.member.displayName;
      if (!oldName.startsWith('[AFK] ')) {
        await interaction.member.setNickname(`[AFK] ${oldName.slice(0, 25)}`).catch(() => null);
      }

      return interaction.editReply({
        embeds: [
          success(
            `تم تفعيل وضع الـ **AFK** بنجاح\n\n- **السبب:** '${reason}'\n- **ملاحظة:** سيتم إلغاء الوضع تلقائياً عند كتابتك لأول رسالة`
          )
        ]
      });
    } catch (err) {
      logger.error('[Command Error - afk.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
