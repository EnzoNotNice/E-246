const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("عرض بانرك أو بانر عضو آخر")
    .addUserOption(o => o.setName('user').setDescription('العضو المراد عرض البانر الخاص به')),

  async execute(interaction) {
    const user = await (interaction.options.getUser('user') || interaction.user).fetch();

    if (!user.banner) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`<:circlex:1519212245559672914> **${user.tag}** ليس لديه بانر`)],
        flags: ['Ephemeral']
      });
    }

    const bannerURL = user.bannerURL({ size: 4096, extension: 'png' });

    const embed = new EmbedBuilder()
      .setColor(user.accentColor || 0x5865F2)
      .setTitle(`<:photo:1519212224239898745> بانر ${user.tag}`)
      .setImage(bannerURL)
      .setDescription(`[تحميل](${bannerURL})`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
