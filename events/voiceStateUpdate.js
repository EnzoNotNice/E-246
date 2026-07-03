const db = require('../database/db');
const { checkLevelUp } = require('../utils/levels');


module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (!newState.member || newState.member.user.bot) return;

    const guildId = newState.guild.id;
    const userId = newState.member.id;

    const isJoining = !oldState.channelId && newState.channelId;
    const isLeaving = oldState.channelId && !newState.channelId;
    const isSwitching = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    const isMuted = newState.selfMute || newState.serverMute || newState.selfDeaf || newState.serverDeaf;
    const wasMuted = oldState.selfMute || oldState.serverMute || oldState.selfDeaf || oldState.serverDeaf;

    const sessionKey = `${guildId}:${userId}`;

    if (isJoining) {
      newState.client.voiceSessions.set(sessionKey, Date.now());
    }

    if (isLeaving) {
      const startTime = newState.client.voiceSessions.get(sessionKey);
      if (startTime) {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        newState.client.voiceSessions.delete(sessionKey);

        if (durationSeconds > 0) {
          db.addVoiceXP(userId, guildId, durationSeconds);
          await checkLevelUp(newState.client, userId, guildId);
        }
      }
    }
  }
};
