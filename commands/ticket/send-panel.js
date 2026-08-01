const logger = require('../../utils/logger');
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send-panel')
    .setDescription('إرسال بانل التذاكر')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('روم إرسال البانل')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption((o) => o.setName('title').setDescription('عنوان البانل'))
    .addStringOption((o) => o.setName('description').setDescription('وصف البانل'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const categories = db.getTicketCategories(interaction.guildId);
      if (!categories.length) {
        return interaction.reply({
          embeds: [error('يرجى إضافة تصنيفات تذاكر أولاً باستخدام `/ticket-setup add-category`')],
          flags: ['Ephemeral']
        });
      }

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const title = interaction.options.getString('title') || '{emoji:ticket} نظام التذاكر';
      const description = interaction.options.getString('description') || 'اختر نوع التذكرة من القائمة أدناه';

      const panelEmbed = new EmbedBuilder()
        .setColor(0x00b0f4)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('اختر نوع التذكرة');

      for (const cat of categories) {
        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.name)
            .setValue(cat.name)
            .setDescription(`فتح تذكرة ${cat.name}`)
            .setEmoji(cat.emoji)
        );
      }

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await channel.send({ embeds: [panelEmbed], components: [row] });
      return interaction.reply({ embeds: [success('تم إرسال بانل التذاكر بنجاح')], flags: ['Ephemeral'] });
    } catch (err) {
      logger.error('[Command Error - send-panel.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
