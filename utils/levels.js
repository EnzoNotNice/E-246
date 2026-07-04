const db = require('../database/db');

function getTextNextLvlXp(level) {
  return 100 * Math.pow(level + 1, 2);
}

function getVoiceNextLvlTime(level) {
  return 60 * 10 * Math.pow(level + 1, 2);
}

async function checkLevelUp(client, userId, guildId, channelId = null) {
  const levelSettings = db.getLevelSettings(guildId);
  if (!levelSettings.enabled) return;

  const userData = db.getLevel(userId, guildId);
  if (!userData) return;

  let textLevel = userData.level || 0;
  let voiceLevel = userData.voice_level || 0;
  let textXp = userData.xp || 0;
  let voiceXp = userData.voice_xp || 0;


  let leveledUpText = false;
  let leveledUpVoice = false;

  while (textXp >= getTextNextLvlXp(textLevel)) {
    textLevel++;
    leveledUpText = true;
  }

  while (voiceXp >= getVoiceNextLvlTime(voiceLevel)) {
    voiceLevel++;
    leveledUpVoice = true;
  }

  if (leveledUpText || leveledUpVoice) {
    db.setLevel(userId, guildId, textLevel, textXp, voiceLevel, voiceXp);

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    let announceCh = null;
    if (levelSettings.channel) {
      announceCh = await guild.channels.fetch(levelSettings.channel).catch(() => null);
    } else if (channelId) {
      announceCh = await guild.channels.fetch(channelId).catch(() => null);
    } else {
      announceCh = guild.systemChannel;
      const me = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
      if (me && (!announceCh || !announceCh.permissionsFor(me).has('SendMessages'))) {
        announceCh = guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(me).has('SendMessages'));
      }
    }

    if (announceCh) {
      const emojis = require('./emojis.json');
      const confettiEmoji = emojis.confetti || '<:confetti:1519212243026448394>';
      const messageEmoji = emojis.message || '<:message:1519212228132208701>';

      if (leveledUpText) {
        announceCh.send({
          content: `${confettiEmoji} مبروك <@${userId}> لقد وصلت لـ **المستوى ${textLevel}**! ${messageEmoji}`
        }).catch(() => null);
      }
      if (leveledUpVoice) {
        announceCh.send({
          content: `${confettiEmoji} مبروك <@${userId}> لقد وصلت لـ **المستوى الصوتي ${voiceLevel}**! 🎙️`
        }).catch(() => null);
      }
    }

    const rewards = JSON.parse(levelSettings.role_rewards || '[]');
    const maxLevel = Math.max(textLevel, voiceLevel);
    const reward = rewards.find(r => r.level === maxLevel);
    if (reward) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        member.roles.add(reward.roleId).catch(() => null);
      }
    }
  }
}

module.exports = { getTextNextLvlXp, getVoiceNextLvlTime, checkLevelUp };
