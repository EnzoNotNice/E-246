const emojiSetup = require('../utils/emojiSetup');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} server(s)`);
    console.log(`Watching ${client.users.cache.size} user(s)`);

    // Run automatic Application Emoji setup
    await emojiSetup(client);

    client.user.setActivity('your server 👀', { type: 3 });

    for (const [, guild] of client.guilds.cache) {
      try {
        const invites = await guild.invites.fetch();
        client.inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
      } catch (e) {
      }
    }
    let voiceCount = 0;
    for (const [, guild] of client.guilds.cache) {
      for (const [, voiceState] of guild.voiceStates.cache) {
        if (!voiceState.member || voiceState.member.user.bot) continue;
        const sessionKey = `${guild.id}:${voiceState.member.id}`;
        client.voiceSessions.set(sessionKey, Date.now());
        voiceCount++;
      }
    }
    console.log(`Initialized ${voiceCount} voice session(s)`);

    const { getAllActiveGiveaways, endGiveaway } = require('../database/db');
    const { endGiveawayTimer } = require('../utils/giveaway');
    const giveaways = getAllActiveGiveaways();
    for (const g of giveaways) {
      const remaining = g.endTime * 1000 - Date.now();
      if (remaining <= 0) {
        await endGiveawayTimer(client, g).catch(() => null);
      } else {
        setTimeout(() => endGiveawayTimer(client, g), remaining);
      }
    }
    console.log(`Resumed ${giveaways.length} active giveaway(s)`);
  }
};
