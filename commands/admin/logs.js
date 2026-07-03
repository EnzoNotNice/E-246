const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

const logTypes = ['ban', 'unban', 'kick', 'timeout', 'warn', 'message_delete', 'message_edit', 'member_join', 'member_leave', 'channel_create', 'channel_delete', 'role_create', 'role_delete', 'nick_change'];
const logColumns = Object.fromEntries(logTypes.map(t => [t, `${t}_channel`]));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('إعداد نظام سجلات السيرفر')
    .addSubcommand(s => s.setName('channel').setDescription('تحديد روم السجلات').addChannelOption(o => o.setName('channel').setDescription('روم السجلات').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('toggle').setDescription('تفعيل أو تعطيل نوع سجل محدد').addStringOption(o => o.setName('type').setDescription('نوع السجل').setRequired(true).addChoices(...logTypes.map(t => ({ name: t.replace(/_/g, ' '), value: t })))))
    .addSubcommand(s => s.setName('show').setDescription('عرض إعدادات السجلات الحالية'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const settings = db.getLogSettings(interaction.guildId);

    if (sub === 'channel') {
      const ch = interaction.options.getChannel('channel');
      db.setLogChannel(interaction.guildId, ch.id);
      return interaction.reply({ embeds: [success(locale.get('moderation.logChannelSet', { channel: ch }))] });
    }

    if (sub === 'toggle') {
      const type = interaction.options.getString('type');
      const column = logColumns[type];
      const guildSettings = db.getGuildSettings(interaction.guildId);
      const mainLogChannel = guildSettings.log_channel;

      if (!mainLogChannel && !settings[column]) {
        return interaction.reply({ embeds: [error('لم يتم تحديد روم السجلات', 'حدد روم السجلات أولاً باستخدام `/logs channel`')], flags: ['Ephemeral'] });
      }

      const current = settings[column];
      db.db.prepare(`UPDATE log_settings SET ${column} = ? WHERE guildId = ?`).run(current ? null : mainLogChannel, interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('moderation.logToggled', { status: current ? 'تعطيل' : 'تفعيل', type: type.replace(/_/g, ' ') }))] });
    }

    if (sub === 'show') {
      const guildSettings = db.getGuildSettings(interaction.guildId);
      const ch = guildSettings.log_channel ? `<#${guildSettings.log_channel}>` : 'غير محدد';
      const rows = logTypes.map(t => `${settings[logColumns[t]] ? '<:circlecheck:1519212246876557413>' : '<:circlex:1519212245559672914>'} \`${t.replace(/_/g, ' ')}\`${settings[logColumns[t]] ? ` → <#${settings[logColumns[t]]}>` : ''}`).join('\n');
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('<:list:1519212232670580868> إعدادات السجلات')
        .addFields({ name: 'الروم المخصص', value: ch }, { name: 'أنواع السجلات', value: rows })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  }
};
