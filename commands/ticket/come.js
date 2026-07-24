const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('come')
    .setDescription('استدعاء صاحب التذكرة ')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {  
      const ticket = db.getTicketByChannel(interaction.channelId);
      if (!ticket) {
        return interaction.reply({ embeds: [error('هذا الروم ليس تذكرة')], flags: ['Ephemeral'] });
      }
  
      const member = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
      if (!member) {
        return interaction.reply({ embeds: [error('صاحب التذكرة غير موجود في السيرفر')], flags: ['Ephemeral'] });
      }
  
      const channelLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}`;
  
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('{emoji:bellringing} استدعاء صاحب التذكرة')
        .setDescription(
          `${member} تم استدعاؤك بواسطة ${interaction.user}\n` +
          `{emoji:ticket} التذكرة: <#${interaction.channelId}>\n\n` +
          `{emoji:bolt} اضغط الزر بالأسفل للدخول السريع`
        )
        .setTimestamp();
  
      const emojis = require('../../utils/emojis.json');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('الدخول السريع')
          .setStyle(ButtonStyle.Link)
          .setURL(channelLink)
          .setEmoji(emojis.ticket || '<:ticket:1525592573039743097>')
      );
  
      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('{emoji:bellringing} تم استدعاؤك')
        .setDescription(
          `{emoji:user} بواسطة: ${interaction.user}\n` +
          `{emoji:ticket} السيرفر: **${interaction.guild.name}**\n` +
          `{emoji:folder} التذكرة: <#${interaction.channelId}>\n\n` +
          `[اضغط هنا للدخول السريع](${channelLink})`
        )
        .setTimestamp();
  
      await member.send({ embeds: [dmEmbed], components: [row] }).catch(() => null);
  
      return interaction.reply({
        content: `<@${ticket.userId}>`,
        embeds: [embed],
        components: [row]
      });
    
    } catch (err) {
      console.error('[Command Error - come.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
