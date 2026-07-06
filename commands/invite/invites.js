const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('عرض دعوات العضو')
    .addUserOption(o => o.setName('user').setDescription('العضو لعرض الدعوات')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const data = db.getInvites(user.id, interaction.guildId);

    const real = data.total - data.fake - data.left;
    const total = real + data.bonus;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`{emoji:mail} ${user.tag} - الدعوات`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '{emoji:circlecheck} الدعوات الحقيقية', value: String(real), inline: true },
        { name: '{emoji:gift} الدعوات الإضافية', value: String(data.bonus), inline: true },
        { name: '{emoji:user} الإجمالي', value: String(total), inline: true },
        { name: '{emoji:circlex} الدعوات المزيفة', value: String(data.fake), inline: true },
        { name: '{emoji:folderopen} غادروا السيرفر', value: String(data.left), inline: true },
        { name: '{emoji:chartpie} الإجمالي الكلي', value: String(data.total), inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
