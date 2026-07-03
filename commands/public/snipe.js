const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('عرض آخر رسالة محذوفة في الروم الحالي'),

  async execute(interaction) {
    const data = db.getSnipe(interaction.channelId);

    if (!data) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('<:circlex:1519212245559672914> لا توجد رسائل محذوفة حديثاً في هذا الروم')],
        flags: ['Ephemeral']
      });
    }

    const user = await interaction.client.users.fetch(data.authorId).catch(() => null);
    const ts = `<t:${data.timestamp}:R>`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: data.authorTag || 'مجهول', iconURL: data.authorAvatar || null })
      .setDescription(data.content || '*[لا يوجد محتوى]*')
      .setFooter({ text: `محذوفة من #${interaction.channel.name}` })
      .setTimestamp(data.timestamp * 1000);

    return interaction.reply({ embeds: [embed] });
  }
};
