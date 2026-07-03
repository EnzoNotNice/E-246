const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send-panel')
    .setDescription('إرسال قائمة إعداد بانل التذاكر')
    .addChannelOption(o => o.setName('channel').setDescription('الروم المراد إرسال البانل فيه').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('title').setDescription('عنوان البانل'))
    .addStringOption(o => o.setName('description').setDescription('وصف البانل'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const settings = db.getTicketSettings(interaction.guildId);
    if (!settings.category_id || !settings.staff_role) {
      return interaction.reply({ embeds: [error(locale.get('tickets.notSetup'))], flags: ['Ephemeral'] });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || '<:ticket:1519212195945119814> نظام التذاكر';
    const description = interaction.options.getString('description') || settings.support_message || 'اضغط على الزر أدناه لفتح تذكرة دعم وسيتواصل معك فريقنا قريبا';

    const panelEmbed = new EmbedBuilder()
      .setColor(0x00B0F4)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('افتح تذكرة').setEmoji('1519212229445029971')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({ embeds: [panelEmbed], components: [row] });
    return interaction.reply({ embeds: [success(locale.get('tickets.panelSent'))], flags: ['Ephemeral'] });
  }
};
