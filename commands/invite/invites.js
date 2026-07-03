const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('عرض دعواتك الحالية أو دعوات عضو آخر')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد عرض دعواته')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const data = db.getInvites(user.id, interaction.guildId);

    const real = data.total - data.fake - data.left;
    const total = real + data.bonus;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`<:mail:1519212229445029971> ${user.tag} - الدعوات`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '<:circlecheck:1519212246876557413> الدعوات الحقيقية', value: String(real), inline: true },
        { name: '<:gift:1519212237317865553> الدعوات الإضافية', value: String(data.bonus), inline: true },
        { name: '<:user:1519212186633764995> الإجمالي', value: String(total), inline: true },
        { name: '<:circlex:1519212245559672914> الدعوات المزيفة', value: String(data.fake), inline: true },
        { name: '<:folderopen:1519212239876395138> غادروا السيرفر', value: String(data.left), inline: true },
        { name: '<:chartpie:1519212248479043634> الإجمالي الكلي', value: String(data.total), inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
