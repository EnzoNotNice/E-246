const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send-panel')
    .setDescription('إرسال بانل التذاكر')
    .addChannelOption(o => o.setName('channel').setDescription('روم إرسال البانل').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption(o => o.setName('title').setDescription('عنوان البانل'))
    .addStringOption(o => o.setName('description').setDescription('وصف البانل'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const settings = db.getTicketSettings(interaction.guildId);
    if (!settings.category_id || !settings.staff_role) {
      return interaction.reply({ embeds: [error(locale.get('tickets.notSetup'))], flags: ['Ephemeral'] });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || '{emoji:ticket} نظام التذاكر';
    const description = interaction.options.getString('description') || settings.support_message || 'اضغط على الزر أدناه لفتح تذكرة دعم وسيتواصل معك فريقنا قريبا';

    const panelEmbed = new EmbedBuilder()
      .setColor(0x00B0F4)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const emojis = require('../../utils/emojis.json');
    const button = new ButtonBuilder()
      .setCustomId('ticket_create_btn')
      .setLabel('افتح تذكرة').setEmoji(emojis.mail || '<:mail:1525592275218731059>')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({ embeds: [panelEmbed], components: [row] });
    return interaction.reply({ embeds: [success(locale.get('tickets.panelSent'))], flags: ['Ephemeral'] });
  }
};
