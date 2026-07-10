const prettyMilliseconds = (() => { const p = require('pretty-ms'); return typeof p === 'function' ? p : p.default; })();
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } = require("discord.js");
const load = require("lodash");
const pms = prettyMilliseconds;

module.exports = {
  data: new SlashCommandBuilder()
	.setName("queue")
	.setDescription('قائمة التشغيل')
	.addNumberOption((o) =>
		o.setName("page").setDescription("Page number").setRequired(false)
	)
	,
  async execute(interaction) {
    const client = interaction.client;
		const channel = interaction.member.voice.channel;
		if (!channel) return interaction.reply({ content: "{emoji:circlex} يجب أن تكون في غرفة صوتية", ephemeral: true });

		const player = client.manager?.getPlayer(interaction.guild.id);
		if (!player) {
			return interaction.reply({
				embeds: [new EmbedBuilder().setColor(0xff0000).setDescription("There are no songs in the queue.")],
				ephemeral: true,
			});
		}

		if (!player.queue.current) {
			return interaction.reply({
				embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription("There's nothing playing.")],
				ephemeral: true,
			});
		}

		await interaction.deferReply().catch(() => {});

		const tracks = player.queue.tracks;
		const current = player.queue.current;

		const cleanTitle = (t) =>
			escapeMarkdown(t.info.title).replace(/[\[\]]/g, "");

		if (!tracks.length) {
			const embed = new EmbedBuilder()
				.setColor(0x5865F2)
				.setDescription(`**♪ | Now playing:** [${cleanTitle(current)}](${current.info.uri})`)
				.addFields(
					{
						name: "Duration",
						value: current.info.isStream
							? "`LIVE`"
							: `\`${pms(player.position, { colonNotation: true })} / ${pms(current.info.duration, { colonNotation: true })}\``,
						inline: true,
					},
					{ name: "Volume", value: `\`${player.volume}\``, inline: true },
					{ name: "Total Tracks", value: `\`1\``, inline: true }
				);

			return interaction.editReply({ embeds: [embed] });
		}

		let queueDuration = tracks.reduce((acc, t) => acc + (t.info.isStream ? 0 : t.info.duration), 0);

		const mapping = tracks.map(
			(t, i) => `\`${i + 1}\` [${cleanTitle(t)}](${t.info.uri}) [${t.requester}]`
		);

		const chunks = load.chunk(mapping, 10);
		const pages = chunks.map((s) => s.join("\n"));

		let page = Math.max(0, (interaction.options.getNumber("page") ?? 1) - 1);
		if (page >= pages.length) page = 0;

		const buildEmbed = (p) =>
			new EmbedBuilder()
				.setColor(0x5865F2)
				.setDescription(
					`**♪ | Now playing:** [${cleanTitle(current)}](${current.info.uri}) [${current.requester}]\n\n**Queued Tracks**\n${pages[p]}`
				)
				.addFields(
					{
						name: "Track Duration",
						value: current.info.isStream
							? "`LIVE`"
							: `\`${pms(player.position, { colonNotation: true })} / ${pms(current.info.duration, { colonNotation: true })}\``,
						inline: true,
					},
					{
						name: "Queue Duration",
						value: `\`${pms(queueDuration, { colonNotation: true })}\``,
						inline: true,
					},
					{ name: "Total Tracks", value: `\`${tracks.length}\``, inline: true }
				)
				.setFooter({ text: `Page ${p + 1}/${pages.length}` });

		if (pages.length === 1) {
			return interaction.editReply({ embeds: [buildEmbed(0)] });
		}

		const prev = new ButtonBuilder().setCustomId("queue_prev").setEmoji("⏮️").setStyle(ButtonStyle.Primary);
		const next = new ButtonBuilder().setCustomId("queue_next").setEmoji("⏭️").setStyle(ButtonStyle.Primary);
		const row = new ActionRowBuilder().addComponents(prev, next);

		await interaction.editReply({ embeds: [buildEmbed(page)], components: [row] });

		const collector = interaction.channel.createMessageComponentCollector({
			filter: (b) => {
				if (b.user.id === interaction.user.id) return true;
				b.reply({ content: `Only **${interaction.user.tag}** can use this.`, ephemeral: true }).catch(() => {});
				return false;
			},
			time: 5 * 60 * 1000,
			idle: 30_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate().catch(() => {});
			if (btn.customId === "queue_next") page = page + 1 < pages.length ? page + 1 : 0;
			else page = page > 0 ? page - 1 : pages.length - 1;
			await interaction.editReply({ embeds: [buildEmbed(page)], components: [row] });
		});
	  }
};
