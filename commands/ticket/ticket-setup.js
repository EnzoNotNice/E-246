const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('إعداد بيانات التذاكر')
    .addChannelOption(o => o.setName('category').setDescription('تصنيف فتح التذاكر').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
    .addRoleOption(o => o.setName('staff_role').setDescription('رتبة إدارة التذاكر').setRequired(true))
    .addChannelOption(o => o.setName('log_channel').setDescription('روم سجل التذاكر').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('ticket_message').setDescription('رسالة فتح تذكرة'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const category = interaction.options.getChannel('category');
    const staffRole = interaction.options.getRole('staff_role');
    const logChannel = interaction.options.getChannel('log_channel');
    const ticketMsg = interaction.options.getString('ticket_message');

    db.db.prepare(`
      INSERT INTO ticket_settings (guildId, category_id, staff_role, log_channel, ticket_message)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guildId) DO UPDATE SET
        category_id = ?, staff_role = ?,
        log_channel = COALESCE(?, log_channel),
        ticket_message = COALESCE(?, ticket_message)
    `).run(
      interaction.guildId, category.id, staffRole.id, logChannel?.id || null, ticketMsg || null,
      category.id, staffRole.id, logChannel?.id || null, ticketMsg || null
    );

    return interaction.reply({
      embeds: [success(locale.get('tickets.setupSuccess', { category: category.name, staffRole, logChannel: logChannel || 'غير محدد' }))]
    });
  }
};
