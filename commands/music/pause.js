const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
	.setName("pause")
	.setDescription('إيقاف مؤقت')
	,
  async execute(interaction) {
    const client = interaction.client;
		const channel = interaction.member.voice.channel;
		if (!channel) return interaction.reply({ content: "{emoji:circlex} يجب أن تكون في غرفة صوتية", ephemeral: true });

		const player = client.manager?.getPlayer(interaction.guild.id);
		if (!player) {
			return interaction.reply({
				embeds: [new EmbedBuilder().setColor(0xff0000).setDescription("Nothing is playing.")],
				ephemeral: true,
			});
		}

		if (player.paused) {
			return interaction.reply({
				embeds: [new EmbedBuilder().setColor(0xff0000).setDescription("Current playing track is already paused!")],
				ephemeral: true,
			});
		}

		await player.pause(true);
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(0x5865F2)
					.setDescription(`⏸ | **Paused!**`),
			],
		});
	  }
};
