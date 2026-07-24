const prettyMilliseconds = (() => { const p = require('pretty-ms'); return typeof p === 'function' ? p : p.default; })();
const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
	.setName("nowplaying")
	.setDescription('الأغنية الحالية')
	,
  async execute(interaction) {
    try {  
      const client = interaction.client;
  		const channel = interaction.member.voice.channel;
  		if (!channel) return interaction.reply({ content: "{emoji:circlex} يجب أن تكون في غرفة صوتية", ephemeral: true });
  
  		const player = client.manager?.getPlayer(interaction.guild.id);
  		if (!player) {
  			return interaction.reply({
  				embeds: [new EmbedBuilder().setColor(0xff0000).setDescription("The bot isn't in a channel.")],
  				ephemeral: true,
  			});
  		}
  
  		if (!player.queue.current) {
  			return interaction.reply({
  				embeds: [new EmbedBuilder().setColor(0xff0000).setDescription("There's nothing playing.")],
  				ephemeral: true,
  			});
  		}
  
  		const song = player.queue.current;
  		const title = escapeMarkdown(song.info.title).replace(/[\[\]]/g, "");
  
  		const embed = new EmbedBuilder()
  			.setColor(0x5865F2)
  			.setAuthor({ name: "Now Playing", iconURL: client.user.displayAvatarURL() })
  			.setDescription(`[${title}](${song.info.uri})`)
  			.addFields(
  				{ name: "{emoji:user} Requested by", value: `<@${song.requester?.id ?? song.requester}>`, inline: true },
  				{
  					name: "{emoji:clock} Duration",
  					value: song.info.isStream
  						? "🔴 `LIVE`"
  						: `\`${prettyMilliseconds(player.position, { secondsDecimalDigits: 0 })} / ${prettyMilliseconds(song.info.duration, { secondsDecimalDigits: 0 })}\``,
  					inline: true,
  				}
  			)
  			.setThumbnail(
  				song.info.artworkUrl ??
  				`https://img.youtube.com/vi/${song.info.identifier}/maxresdefault.jpg`
  			);
  
  		return interaction.reply({ embeds: [embed] });
  	  
    } catch (err) {
      console.error('[Command Error - nowplaying.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
