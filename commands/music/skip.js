const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
	.setName("skip")
	.setDescription('تخطي الأغنية')
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
  						.setDescription("There is nothing to skip."),
  				],
  				ephemeral: true,
  			});
  		} 
          const song = player.queue.current;
          const autoQueue = player.get("autoQueue");
          if (player.queue.tracks.length === 0 && (!autoQueue || autoQueue === false)) {
  		return interaction.reply({
  			embeds: [
  				new EmbedBuilder()
  					.setColor(0xff0000)
  					.setDescription(`There is nothing after [${ song.info.title }](${ song.info.uri }) in the queue.`),
  			],
  		})}
  		
  		await player.skip();
  		
  		interaction.reply({
  			embeds: [
  				new EmbedBuilder()
  					.setColor(0x5865F2)
  					.setDescription("✅ | **Skipped!**"),
  			],
  		});
  	  
    } catch (err) {
      console.error('[Command Error - skip.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
