const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('إعداد بيانات التذاكر')
    .addChannelOption(o => o.setName('category').setDescription('تصنيف فتح التذاكر').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
    .addRoleOption(o => o.setName('staff_role').setDescription('رتبة إدارة التذاكر').setRequired(true))
    .addChannelOption(o => o.setName('log_channel').setDescription('روم سجل التذاكر').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addChannelOption(o => o.setName('feedbacks_channel').setDescription('روم تقييم الاداري').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption(o => o.setName('ticket_message').setDescription('رسالة فتح تذكرة'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const category = interaction.options.getChannel('category');
    const staffRole = interaction.options.getRole('staff_role');
    const logChannel = interaction.options.getChannel('log_channel');
    const feedbacksChannel = interaction.options.getChannel('feedbacks_channel');
    const ticketMsg = interaction.options.getString('ticket_message');

    const data = {
      category_id: category.id,
      staff_role: staffRole.id,
    };
    if (logChannel) data.log_channel = logChannel.id;
    if (feedbacksChannel) data.feedbacks_channel = feedbacksChannel.id;
    if (ticketMsg) data.ticket_message = ticketMsg;

    await db.updateTicketSettings(interaction.guildId, data);

    return interaction.reply({
      embeds: [success(locale.get('tickets.setupSuccess', {
        category: category.name,
        staffRole,
        logChannel: logChannel || 'غير محدد'
      }))]
    });
  }
};
