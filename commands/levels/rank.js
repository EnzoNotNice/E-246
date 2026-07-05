const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { createRankCard } = require('../../utils/canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('عرض تقدم مستواك وترتيبك في السيرفر ببطاقة رتبة حديثة')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد عرض رتبته')),

  async execute(interaction) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user') || interaction.user;
    let data = db.getLevel(user.id, interaction.guildId);

    if (!data) data = { xp: 0, level: 0, voice_xp: 0, voice_level: 0, messages: 0 };

    const textXp = data.xp || 0;
    const textLevel = data.level || 0;
    let voiceTime = data.voice_xp || 0;
    const voiceLevel = data.voice_level || 0;
    const messagesCount = data.messages || 0;

    let activeStart = null;
    if (interaction.client.voiceSessions) {
      const sessionKey = `${interaction.guildId}:${user.id}`;
      activeStart = interaction.client.voiceSessions.get(sessionKey);
    }

    if (textXp === 0 && voiceTime === 0 && !activeStart) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`{emoji:circlex} **${user.tag}** لا يملك نقاط خبرة بعد`)]
      });
    }

    let liveVoiceLevel = voiceLevel;
    if (activeStart) {
      const liveSeconds = Math.floor((Date.now() - activeStart) / 1000);
      if (liveSeconds > 0) {
        voiceTime += liveSeconds;
        
        const { getVoiceNextLvlTime } = require('../../utils/levels');
        while (voiceTime >= getVoiceNextLvlTime(liveVoiceLevel)) {
          liveVoiceLevel++;
        }
      }
    }

    const buffer = await createRankCard(user, textXp, textLevel, voiceTime, liveVoiceLevel, messagesCount);
    const attachment = new AttachmentBuilder(buffer, { name: 'rank.png' });

    return interaction.editReply({ files: [attachment] });
  }
};
