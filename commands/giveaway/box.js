const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('box')
    .setDescription('إرسال صندوق؛ أول شخص يضغط يفوز بالجائزة')
    .addStringOption(o => o.setName('prize').setDescription('الجائزة').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('الروم الذي سيُرسل فيه الصندوق'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const prize = interaction.options.getString('prize');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const embed = new EmbedBuilder()
      .setColor(0xFF73FA)
      .setTitle('<:gift:1519212237317865553> صندوق الغموض')
      .setDescription(`**${interaction.user.tag}** أرسل صندوق الغموض\nالجائزة: **${prize}**\n\nأول من يضغط الزر يفوز`)
      .setTimestamp();

    const emojis = require('../../utils/emojis.json');
    const button = new ButtonBuilder()
      .setCustomId(`box_${interaction.user.id}_${Date.now()}_${encodeURIComponent(prize)}`)
      .setLabel('اضغط للفوز').setEmoji(emojis.gift || '1519212237317865553')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    const msg = await channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ embeds: [success(locale.get('giveaway.boxSent'))], flags: ['Ephemeral'] });
  }
};
