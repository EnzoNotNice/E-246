const prettyMilliseconds = (() => { const p = require('pretty-ms'); return typeof p === 'function' ? p : p.default; })();
const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
  .setName("play")
  .setDescription('تشغيل أغنية')
  .addStringOption((option) =>
    option
      .setName('song').setDescription('اسم الأغنية أو الرابط')
      .setRequired(true)
      .setAutocomplete(true)
  )
  ,
  async execute(interaction) {
    try {  
      const client = interaction.client;
  
      await interaction.deferReply();
  
      const channel = interaction.member.voice.channel;
      if (!channel) return interaction.editReply({ content: "{emoji:circlex} يجب أن تكون في غرفة صوتية" });
  
      const hasNode = [...client.manager.nodeManager.nodes.values()].some(node => node.connected);
      if (!hasNode) return interaction.editReply({ content: "{emoji:circlex} لا يوجد اتصال بخادم الموسيقى" });
  
      const query = interaction.options.getString("song") || interaction.options.getString("query");
      if (!query || !query.trim()) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`{emoji:circlex} **` + "Please provide a valid song name or URL." + `**`)],
        });
      }
  
      let player = client.manager.getPlayer(interaction.guild.id);
      const isNewPlayer = !player;
  
      if (isNewPlayer) {
        player = client.manager.createPlayer({
          guildId: interaction.guild.id,
          voiceChannelId: channel.id,
          textChannelId: interaction.channel.id,
          selfDeaf: true,
        });
        await player.connect();
      }
  
      player.set("requester", interaction.user);
  
      const res = await player.search({ query }, interaction.user).catch((err) => {
        console.error(err);
        return { loadType: "error" };
      });
  
      if (res.loadType === "error") {
        if (isNewPlayer) player.destroy();
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`{emoji:circlex} **` + "There was an error while searching for that song." + `**`)],
        });
      }
  
      if (res.loadType === "empty") {
        if (isNewPlayer) player.destroy();
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`{emoji:circlex} **` + "No results were found for that query." + `**`)],
        });
      }
  
      if (res.loadType === "track" || res.loadType === "search") {
        const track = res.tracks[0];
        await player.queue.add(track);
        if (!player.playing) {
          await player.play({ paused: false });
        }
  
        const title = escapeMarkdown(track.info.title).replace(/[\[\]]/g, "");
        const addEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: "Added to queue", iconURL: client.user.displayAvatarURL() })
          .setDescription(`[${title}](${track.info.uri})`)
          .addFields(
            { name: "Added by", value: `<@${interaction.user.id}>`, inline: true },
            {
              name: "Duration",
              value: track.info.isStream
                ? "`LIVE 🔴`"
                : `\`${prettyMilliseconds(track.info.duration, { colonNotation: true, secondsDecimalDigits: 0 })}\``,
              inline: true,
            }
          )
          .setThumbnail(
            track.info.artworkUrl ??
            `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`
          );
  
        if (player.queue.tracks.length > 1) {
          addEmbed.addFields({
            name: "Position in queue",
            value: `\`${player.queue.tracks.length}\``,
            inline: true,
          });
        }
  
        return interaction.editReply({ embeds: [addEmbed] });
      }
  
      if (res.loadType === "playlist") {
        await player.queue.add(res.tracks);
        if (!player.playing) {
          await player.play({ paused: false });
        }
  
        const playlistEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: "Playlist added to queue", iconURL: client.user.displayAvatarURL() })
          .setDescription(`[${res.playlist?.name ?? "Playlist"}](${query})`)
          .addFields(
            { name: "Enqueued", value: `\`${res.tracks.length}\` songs`, inline: true },
            {
              name: "Playlist duration",
              value: `\`${prettyMilliseconds(res.playlist?.duration ?? 0, { colonNotation: true, secondsDecimalDigits: 0 })}\``,
              inline: true,
            }
          );
  
        if (res.tracks[0]?.info?.artworkUrl) {
          playlistEmbed.setThumbnail(res.tracks[0].info.artworkUrl);
        }
  
        return interaction.editReply({ embeds: [playlistEmbed] });
      }
      
    } catch (err) {
      console.error('[Command Error - play.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
