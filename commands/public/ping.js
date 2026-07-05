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
      .setTitle('{emoji:bolt} بينق')
      .addFields(
        { name: '{emoji:clock} زمن الاستجابة', value: `\`${roundtrip}ms\``, inline: true },
        { name: '{emoji:heart} نبضة الـ WebSocket', value: `\`${ws}ms\``, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embed] });
  }
};
