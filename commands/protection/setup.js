const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const locale = require('../../utils/locale');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('إعداد خيارات حماية السيرفر')
    .addSubcommand(s => s.setName('enable').setDescription('تفعيل نظام الحماية'))
    .addSubcommand(s => s.setName('disable').setDescription('تعطيل نظام الحماية'))
    .addSubcommand(s => s.setName('show').setDescription('عرض حالة نظام الحماية'))
    .addSubcommand(s => s.setName('action').setDescription('تحديد الإجراء عند تجاوز الحد')
      .addStringOption(o => o.setName('action').setDescription('الإجراء').setRequired(true).addChoices(
        { name: 'Ban', value: 'ban' },
        { name: 'Kick', value: 'kick' },
        { name: 'Remove Roles', value: 'removeroles' }
      )))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const prot = db.getProtection(interaction.guildId);

    if (sub === 'enable') {
      db.db.prepare('UPDATE protection_settings SET enabled = 1 WHERE guildId = ?').run(interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('protection.enabled'))] });
    }

    if (sub === 'disable') {
      db.db.prepare('UPDATE protection_settings SET enabled = 0 WHERE guildId = ?').run(interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('protection.disabled'))] });
    }

    if (sub === 'action') {
      const action = interaction.options.getString('action');
      db.db.prepare('UPDATE protection_settings SET action = ? WHERE guildId = ?').run(action, interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('protection.actionSet', { action }))] });
    }

    if (sub === 'show') {
      const wl = db.getWhitelist(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('<:shield:1519212202676977788> نظام الحماية')
        .addFields(
          { name: '<:chartpie:1519212248479043634> الحالة', value: prot.enabled ? '<:circlecheck:1519212246876557413> نشط' : '<:circlex:1519212245559672914> معطل', inline: true },
          { name: '<:bolt:1519212174529134754> الإجراء', value: prot.action === 'ban' ? 'باند' : prot.action === 'kick' ? 'طرد' : 'سحب رتب', inline: true },
          { name: '<:shieldlock:1519212205638287522> حد الباند', value: String(prot.ban_limit), inline: true },
          { name: '<:circlex:1519212245559672914> حد الطرد', value: String(prot.kick_limit), inline: true },
          { name: '<:folder:1519212238160924692> حد القنوات', value: String(prot.channel_limit), inline: true },
          { name: '<:user:1519212186633764995> حد الرتب', value: String(prot.role_limit), inline: true },
          { name: '<:heart:1519212171324821624> القائمة البيضاء', value: wl.length ? wl.map(w => `<@${w.targetId}>`).join(', ') : 'لا يوجد' }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  }
};
