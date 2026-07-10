const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('يجعل البوت يقول رسالة محددة')
    .addStringOption(o => o.setName('message').setDescription('الرسالة التي تريد إرسالها').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('القناة المراد إرسال الرسالة إليها (اختياري)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const text = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel.isTextBased()) {
      return interaction.reply({ embeds: [error('القناة المحددة يجب أن تكون قناة نصية.')], flags: ['Ephemeral'] });
    }

    try {
      await targetChannel.send({ content: text });
      return interaction.reply({ embeds: [success(`تم إرسال الرسالة بنجاح في ${targetChannel}`)], flags: ['Ephemeral'] });
    } catch (e) {
      return interaction.reply({ embeds: [error('فشل إرسال الرسالة. تأكد من صلاحيات البوت في القناة المحددة.')], flags: ['Ephemeral'] });
    }
  }
};
