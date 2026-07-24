const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const colors = require("colors");

module.exports = {
  data: new SlashCommandBuilder()
	.setName("247")
	.setDescription('تشغيل 24/7')
	,
  async execute(interaction) {
    try {  
      const client = interaction.client;
      const options = interaction.options;
  		const channel = interaction.member.voice.channel;
  		if (!channel) return interaction.reply({ content: "{emoji:circlex} يجب أن تكون في غرفة صوتية", ephemeral: true });
  		
  		let player;
  		if (client.manager) {
  			player = client.manager.getPlayer(interaction.guild.id);
  		} else {
  			return interaction.reply({
  				embeds: [
  					new EmbedBuilder()
  						.setColor(0xff0000)
  						.setDescription("Lavalink node is not connected"),
  				],
  			});
  		}
  		
  		if (!player) {
  			return interaction.reply({
  				embeds: [
  					new EmbedBuilder()
  						.setColor(0xff0000)
  						.setDescription("There's nothing to play 24/7."),
  				],
  				ephemeral: true,
  			});
  		}
  		
  		let twentyFourSevenEmbed = new EmbedBuilder().setColor(
  			0x5865F2,
  		);
  		const twentyFourSeven = player.get("twentyFourSeven");
  		
  		if (!twentyFourSeven || twentyFourSeven === false) {
  			player.set("twentyFourSeven", true);
  		} else {
  			player.set("twentyFourSeven", false);
  		}
  		twentyFourSevenEmbed
  		  .setDescription(`**24/7 mode is** \`${!twentyFourSeven ? "ON" : "OFF"}\``)
  		  .setFooter({
  		    text: `The bot will ${!twentyFourSeven ? "now" : "no longer"} stay connected to the voice channel 24/7.`
        });
  		console.log(
  			`Player: ${ player.guildId } | [${ colors.blue(
  				"24/7",
  			) }] has been [${ colors.blue(
  				!twentyFourSeven? "ENABLED" : "DISABLED",
  			) }] in ${
  				client.guilds.cache.get(player.guildId)
  					? client.guilds.cache.get(player.guildId).name
  					: "a guild"
  			}`,
  		);
  		
  		if (!player.playing && player.queue.tracks.length + 1 === 0 && twentyFourSeven) {
  			player.destroy();
  		}
  		
  		return interaction.reply({ embeds: [twentyFourSevenEmbed] });
  	  
    } catch (err) {
      console.error('[Command Error - 247.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
