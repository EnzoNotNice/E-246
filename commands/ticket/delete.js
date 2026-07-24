const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('حذف التذكرة الحالية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {  
      const ticket = db.getTicketByChannel(interaction.channelId);
      if (!ticket) return interaction.reply({ embeds: [error(locale.get('tickets.notTicket'))], flags: ['Ephemeral'] });
  
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('{emoji:trash} جارٍ حذف التذكرة')
        .setDescription(`ستُحذف هذه التذكرة خلال **5 ثوانٍ** بواسطة ${interaction.user}`)
        .setTimestamp();
  
      await interaction.reply({ embeds: [embed] });
  
      const settings = db.getTicketSettings(interaction.guildId);
      const logTicket = require('../../utils/ticketlogger');
      const discordTranscripts = require('discord-html-transcripts');
  
      await logTicket(
          interaction.guild,
          settings,
          "{emoji:trash} Ticket Deleted",
          `التذكرة: ${interaction.channel.name}\nحذفت بواسطة: ${interaction.user}`,
          "#ef4444"
      );
  
      const attachment = await discordTranscripts.createTranscript(
          interaction.channel,
          {
              limit: -1,
              returnType: "attachment",
              filename: `${interaction.channel.name}.html`
          }
      ).catch(() => null);
  
      if (attachment) {
          const logCh = interaction.guild.channels.cache.get(settings.log_channel);
          if (logCh) {
              await logCh.send({
                  content: `📂 **سجل التذكرة المحذوفة:** \`${interaction.channel.name}\``,
                  files: [attachment]
              }).catch(console.error);
          }
      }
  
      setTimeout(async () => {
        await interaction.channel.delete(`Ticket deleted by ${interaction.user.tag}`).catch(() => null);
      }, 5000);
    
    } catch (err) {
      console.error('[Command Error - delete.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
