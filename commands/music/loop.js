const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
	.setName("loop")
	.setDescription('تكرار التشغيل')
	,
  async execute(interaction) {
    try {  
      const client = interaction.client;
  		const channel = interaction.member.voice.channel;
  		if (!channel) return interaction.reply({ content: "{emoji:circlex} يجب أن تكون في غرفة صوتية", ephemeral: true });
  
  		const player = client.manager?.getPlayer(interaction.guild.id);
  		if (!player) {
  			return interaction.reply({
  				embeds: [new EmbedBuilder().setColor(0xff0000).setDescription("Nothing is playing right now.")],
  				ephemeral: true,
  			});
  		}
  
  		if (player.repeatMode === "off") {
  			await player.setRepeatMode("track");
  		} else if (player.repeatMode === "track") {
  			await player.setRepeatMode("queue");
  		} else {
  			await player.setRepeatMode("off");
  		}
  
  		const modeText = { track: "🔂 Track Loop", queue: "🔁 Queue Loop", off: "Loop Off" };
  		return interaction.reply({
  			embeds: [
  				new EmbedBuilder()
  					.setColor(0x5865F2)
  					.setDescription(`👍 | **${modeText[player.repeatMode]}**`),
  			],
  		});
  	  
    } catch (err) {
      console.error('[Command Error - loop.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
