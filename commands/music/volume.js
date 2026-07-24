const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
	.setName("volume")
	.setDescription('تغيير الصوت')
	.addNumberOption((option) =>
		option
			.setName('amount').setDescription('مستوى الصوت')
			.setRequired(false),
	)
	,
  async execute(interaction) {
    try {  
      const client = interaction.client;
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
  						.setDescription("There is no music playing."),
  				],
  				ephemeral: true,
  			});
  		}
  		
  		let vol = interaction.options.getNumber("amount");
  		if (!vol || vol < 1 || vol > 125) {
  			return interaction.reply({
  				embeds: [
  					new EmbedBuilder()
  						.setColor(0x5865F2)
  						.setDescription(
  							`:loud_sound: | Current volume **${ player.volume }**`,
  						),
  				],
  			});
  		}
  		
  		await player.setVolume(vol);
  		return interaction.reply({
  			embeds: [
  				new EmbedBuilder()
  					.setColor(0x5865F2)
  					.setDescription(
  						`:loud_sound: | Successfully set volume to **${ player.volume }**`,
  					),
  			],
  		});
  	  
    } catch (err) {
      console.error('[Command Error - volume.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
