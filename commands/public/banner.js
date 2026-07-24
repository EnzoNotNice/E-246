const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('عرض بانر العضو')
    .addUserOption(o => o.setName('user').setDescription('العضو لعرض بانره')),

  async execute(interaction) {
    try {  
      const user = await (interaction.options.getUser('user') || interaction.user).fetch();
  
      if (!user.banner) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`{emoji:circlex} **${user.tag}** ليس لديه بانر`)],
          flags: ['Ephemeral']
        });
      }
  
      const bannerURL = user.bannerURL({ size: 4096, extension: 'png' });
  
      const embed = new EmbedBuilder()
        .setColor(user.accentColor || 0x5865F2)
        .setTitle(`{emoji:photo} بانر ${user.tag}`)
        .setImage(bannerURL)
        .setDescription(`[تحميل](${bannerURL})`)
        .setTimestamp();
  
      return interaction.reply({ embeds: [embed] });
    
    } catch (err) {
      console.error('[Command Error - banner.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
