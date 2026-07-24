const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const locale = require('../../utils/locale');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('final')
    .setDescription('مسابقة آخر رسالة')
    .addStringOption(o => o.setName('prize').setDescription('الجائزة').setRequired(true))
    .addIntegerOption(o => o.setName('duration').setDescription('المدة بالثواني').setRequired(true).setMinValue(10).setMaxValue(300))
    .addChannelOption(o => o.setName('channel').setDescription('روم المسابقة'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {  
      const prize = interaction.options.getString('prize');
      const duration = interaction.options.getInteger('duration');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
  
      const endTime = Date.now() + duration * 1000;
  
      const embed = new EmbedBuilder()
        .setColor(0xFF73FA)
        .setTitle('{emoji:flag} مسابقة آخر رسالة')
        .setDescription(`أرسل رسالة في هذا الروم\n\n**الجائزة:** ${prize}\n**آخر شخص يرسل رسالة قبل انتهاء الوقت يفوز**\n\nينتهي الوقت: <t:${Math.floor(endTime / 1000)}:R>`)
        .setTimestamp();
  
      const msg = await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `تم إطلاق المسابقة في ${channel}`, flags: ['Ephemeral'] });
  
      const filter = m => !m.author.bot;
      const collector = channel.createMessageCollector({ filter, time: duration * 1000 });
      let lastMessage = null;
  
      collector.on('collect', m => { lastMessage = m; });
  
      collector.on('end', async () => {
        if (!lastMessage) {
          return channel.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('{emoji:flag} انتهت المسابقة').setDescription('لم يشارك أحد')] });
        }
        const winEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('{emoji:confetti} فائز مسابقة آخر رسالة')
          .setDescription(`مبروك ${lastMessage.author}\n\nلقد أرسلت آخر رسالة وفزت بـ **${prize}**`)
          .setThumbnail(lastMessage.author.displayAvatarURL())
          .setTimestamp();
        channel.send({ embeds: [winEmbed] }).catch(() => null);
      });
    
    } catch (err) {
      console.error('[Command Error - final.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
