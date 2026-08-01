const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder().setName('247').setDescription('تشغيل 24/7'),
  async execute(interaction) {
    try {
      const client = interaction.client;
      const channel = interaction.member.voice.channel;
      if (!channel) return interaction.reply({ content: '{emoji:circlex} يجب أن تكون في غرفة صوتية', ephemeral: true });

      let player;
      if (client.manager) {
        player = client.manager.getPlayer(interaction.guild.id);
      } else {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('Lavalink node is not connected')]
        });
      }

      if (!player) {
        player = client.manager.createPlayer({
          guildId: interaction.guild.id,
          voiceChannelId: channel.id,
          textChannelId: interaction.channel.id,
          selfDeaf: true
        });
        await player.connect();
      }

      const twentyFourSevenEmbed = new EmbedBuilder().setColor(0x5865f2);
      const twentyFourSeven = player.get('twentyFourSeven');
      const newState = !twentyFourSeven;

      player.set('twentyFourSeven', newState);

      twentyFourSevenEmbed.setDescription(`**وضع 24/7 الان:** \`${newState ? 'مفعل 🟢' : 'معطل 🔴'}\``).setFooter({
        text: `سيقوم البوت ${newState ? 'بالبقاء في الروم الصوتي 24/7' : 'بالخروج عند انتهاء قائمة التشغيل'}.`
      });

      if (!newState && !player.playing && player.queue.tracks.length === 0) {
        player.destroy();
      }

      return interaction.reply({ embeds: [twentyFourSevenEmbed] });
    } catch (err) {
      logger.error('[Command Error - 247.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
