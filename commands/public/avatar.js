const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('عرض صورة شخصية')
    .addUserOption(o => o.setName('user').setDescription('العضو لعرض صورته')),

  async execute(interaction) {
    try {  
      const user = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild.members.cache.get(user.id);
  
      const globalAvatar = user.displayAvatarURL({ size: 4096, extension: 'png' });
      const serverAvatar = member?.displayAvatarURL({ size: 4096, extension: 'png' });
  
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`{emoji:photo} ${user.tag}'s Avatar`)
        .setImage(serverAvatar || globalAvatar)
        .setTimestamp();
  
      if (serverAvatar && serverAvatar !== globalAvatar) {
        embed.setDescription(`[الصورة الشخصية](${globalAvatar}) | [صورة السيرفر](${serverAvatar})`);
      } else {
        embed.setDescription(`[تحميل](${globalAvatar})`);
      }
  
      return interaction.reply({ embeds: [embed] });
    
    } catch (err) {
      console.error('[Command Error - avatar.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
