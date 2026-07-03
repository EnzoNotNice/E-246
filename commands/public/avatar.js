const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("عرض صورتك الشخصية أو صورة عضو آخر")
    .addUserOption(o => o.setName('user').setDescription('العضو المراد عرض صورته الشخصية')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const globalAvatar = user.displayAvatarURL({ size: 4096, extension: 'png' });
    const serverAvatar = member?.displayAvatarURL({ size: 4096, extension: 'png' });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`<:photo:1519212224239898745> ${user.tag}'s Avatar`)
      .setImage(serverAvatar || globalAvatar)
      .setTimestamp();

    if (serverAvatar && serverAvatar !== globalAvatar) {
      embed.setDescription(`[الصورة الشخصية](${globalAvatar}) | [صورة السيرفر](${serverAvatar})`);
    } else {
      embed.setDescription(`[تحميل](${globalAvatar})`);
    }

    return interaction.reply({ embeds: [embed] });
  }
};
