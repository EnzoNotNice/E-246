const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
	.setName("stop")
	.setDescription('إيقاف الموسيقى')
	,
  async execute(interaction) {
    const client = interaction.client;
		const channel = interaction.member.voice.channel;
		if (!channel) return interaction.reply({ content: "{emoji:circlex} يجب أن تكون في غرفة صوتية", ephemeral: true });

		const player = client.manager?.getPlayer(interaction.guild.id);
		if (!player) {
			return interaction.reply({
				embeds: [new EmbedBuilder().setColor(0xff0000).setDescription("I'm not in a channel.")],
				ephemeral: true,
			});
		}

		if (player.get("twentyFourSeven")) {
			await player.queue.splice(0, player.queue.tracks.length);
			await player.stopPlaying(true, false);
			player.set("autoQueue", false);
		} else {
			player.destroy();
		}

		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(0x5865F2)
					.setDescription(":wave: | **Bye Bye!**"),
			],
		});
	  }
};
