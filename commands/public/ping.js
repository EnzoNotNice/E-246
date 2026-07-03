const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const locale = require('../../utils/locale');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("اختبار سرعة استجابة البوت"),

  async execute(interaction) {
    await interaction.reply({ content: locale.get('general.pingMsg') });
    const sent = await interaction.fetchReply();
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('<:bolt:1519212174529134754> بينق')
      .addFields(
        { name: '<:clock:1519212244263632916> زمن الاستجابة', value: `\`${roundtrip}ms\``, inline: true },
        { name: '<:heart:1519212171324821624> نبضة الـ WebSocket', value: `\`${ws}ms\``, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embed] });
  }
};
