const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('إعداد بيانات التذاكر')
    .addSubcommand(sub => sub
      .setName('add-category')
      .setDescription('إضافة تصنيف تذاكر جديد')
      .addStringOption(o => o.setName('name').setDescription('اسم التصنيف').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('إيموجي التصنيف'))
      .addChannelOption(o => o.setName('category').setDescription('تصنيف فتح التذاكر').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
      .addRoleOption(o => o.setName('staff_role').setDescription('رتبة إدارة التذاكر').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remove-category')
      .setDescription('إزالة تصنيف تذاكر')
      .addStringOption(o => o.setName('name').setDescription('اسم التصنيف').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('general')
      .setDescription('إعدادات عامة للتذاكر')
      .addChannelOption(o => o.setName('log_channel').setDescription('روم سجل التذاكر').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addChannelOption(o => o.setName('feedbacks_channel').setDescription('روم تقييم الاداري').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption(o => o.setName('ticket_message').setDescription('رسالة فتح تذكرة'))
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('عرض قائمة التصنيفات')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (sub === 'add-category') {
        const name = interaction.options.getString('name');
        const emoji = interaction.options.getString('emoji');
        const category = interaction.options.getChannel('category');
        const staffRole = interaction.options.getRole('staff_role');

        const categories = db.getTicketCategories(guildId) || [];
        if (categories.find(c => c.name === name)) {
          return interaction.reply({ embeds: [error('هذا التصنيف موجود بالفعل')], flags: ['Ephemeral'] });
        }

        db.addTicketCategory(guildId, {
          name,
          emoji: emoji || '🎫',
          categoryId: category.id,
          staffRoleId: staffRole.id
        });

        return interaction.reply({
          embeds: [success(`تم إضافة التصنيف **${name}** ${emoji || '🎫'} بنجاح`)]
        });
      }

      if (sub === 'remove-category') {
        const name = interaction.options.getString('name');
        db.removeTicketCategory(guildId, name);
        return interaction.reply({
          embeds: [success(`تم إزالة التصنيف **${name}** بنجاح`)]
        });
      }

      if (sub === 'general') {
        const logChannel = interaction.options.getChannel('log_channel');
        const feedbacksChannel = interaction.options.getChannel('feedbacks_channel');
        const ticketMsg = interaction.options.getString('ticket_message');

        const data = {};
        if (logChannel) data.log_channel = logChannel.id;
        if (feedbacksChannel) data.feedbacks_channel = feedbacksChannel.id;
        if (ticketMsg) data.ticket_message = ticketMsg;

        await db.updateTicketSettings(guildId, data);

        return interaction.reply({
          embeds: [success('تم تحديث الإعدادات العامة بنجاح')]
        });
      }

      if (sub === 'list') {
        const categories = db.getTicketCategories(guildId) || [];
        if (!categories.length) {
          return interaction.reply({ embeds: [success('لا توجد تصنيفات تذاكر حالياً')], flags: ['Ephemeral'] });
        }

        const list = categories.map(c => `${c.emoji} **${c.name}** - <#${c.categoryId}>`).join('\n');
        return interaction.reply({
          embeds: [success('قائمة تصنيفات التذاكر', list)]
        });
      }
    
    } catch (err) {
      console.error('[Command Error - ticket-setup.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
