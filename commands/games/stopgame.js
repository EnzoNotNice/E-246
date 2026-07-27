const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stopgame')
    .setDescription('إيقاف اللعبة الحالية في الروم')
    .addChannelOption(o => o.setName('channel').setDescription('روم اللعبة').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {  
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const guildId = interaction.guildId;

      // Remove active game from database
      db.removeActiveGame(channel.id, guildId);

      // Send notification
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('{emoji:stop} تم إيقاف اللعبة')
        .setDescription(`تم إيقاف اللعبة الحالية في <#${channel.id}> بواسطة <@${interaction.user.id}>`)
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => null);
      
      return interaction.reply({
        embeds: [success('تم إيقاف اللعبة بنجاح')]
      });
    
    } catch (err) {
      console.error('[Command Error - stopgame.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
  }
};
