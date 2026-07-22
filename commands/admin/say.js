const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('يجعل البوت يقول رسالة محددة ويفتح نافذة لإدخال الرسالة')
    .addChannelOption(o => o.setName('channel').setDescription('القناة المراد إرسال الرسالة إليها (اختياري)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel.isTextBased()) {
      return interaction.reply({ embeds: [error('القناة المحددة يجب أن تكون قناة نصية.')], flags: ['Ephemeral'] });
    }

    const modal = new ModalBuilder()
      .setCustomId(`say_modal_${targetChannel.id}`)
      .setTitle('إرسال رسالة عبر البوت');

    const messageInput = new TextInputBuilder()
      .setCustomId('message_text')
      .setLabel('محتوى الرسالة')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('اكتب الرسالة هنا... سيتم الحفاظ على التنسيق والأسطر بالكامل.')
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  }
};
