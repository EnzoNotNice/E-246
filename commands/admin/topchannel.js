const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topchannel')
    .setDescription('رفع الروم للأعلى')
    .addChannelOption(o => o.setName('channel').setDescription('الروم للرفع'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {  
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.setPosition(0);
      return interaction.reply({ embeds: [success(locale.get('moderation.topChannelSuccess', { channel }))] });
    
    } catch (err) {
      console.error('[Command Error - topchannel.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
