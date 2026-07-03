const NodeCache = require('node-cache');

class CacheManager {
  constructor() {
    this.userCache = new NodeCache({
      stdTTL: 300,
      checkperiod: 120,
      useClones: false
    });

    this.guildSettingsCache = new NodeCache({
      stdTTL: 60,
      checkperiod: 30
    });

    this.leaderboardCache = new NodeCache({
      stdTTL: 30,
      checkperiod: 15
    });

    this.protectionSettingsCache = new NodeCache({
      stdTTL: 45,
      checkperiod: 20
    });

    this.statsCache = new NodeCache({
      stdTTL: 10,
      checkperiod: 5
    });
  }

  getUserLevel(guildId, userId) {
    const key = `${guildId}:${userId}`;
    return this.userCache.get(key);
  }

  setUserLevel(guildId, userId, data) {
    const key = `${guildId}:${userId}`;
    this.userCache.set(key, data);
  }

  getGuildSettings(guildId) {
    return this.guildSettingsCache.get(guildId);
  }

  setGuildSettings(guildId, data) {
    this.guildSettingsCache.set(guildId, data);
  }

  getLeaderboard(guildId) {
    return this.leaderboardCache.get(guildId);
  }

  setLeaderboard(guildId, data) {
    this.leaderboardCache.set(guildId, data);
  }

  getProtectionSettings(guildId) {
    return this.protectionSettingsCache.get(guildId);
  }

  setProtectionSettings(guildId, data) {
    this.protectionSettingsCache.set(guildId, data);
  }

  getStats() {
    return this.statsCache.get('bot_stats');
  }

  setStats(data) {
    this.statsCache.set('bot_stats', data);
  }

  clearUserCache(guildId, userId = null) {
    if (userId) {
      this.userCache.del(`${guildId}:${userId}`);
    } else {
      this.userCache.keys().forEach(key => {
        if (key.startsWith(`${guildId}:`)) {
          this.userCache.del(key);
        }
      });
    }
  }

  clearGuildCache(guildId) {
    [this.guildSettingsCache, this.leaderboardCache, this.protectionSettingsCache].forEach(cache => {
      cache.del(guildId);
    });
  }

  invalidateCache(guildId, userId = null) {
    this.clearGuildCache(guildId);
    if (userId) {
      this.clearUserCache(guildId, userId);
    }
  }

  getCacheStats() {
    const statsFor = (cache) => {
      const stats = cache.getStats();
      return {
        keys: cache.keys().length,
        hits: stats.hits,
        misses: stats.misses,
        ksize: stats.ksize,
        vsize: stats.vsize
      };
    };

    return {
      userCache: statsFor(this.userCache),
      guildSettingsCache: statsFor(this.guildSettingsCache),
      leaderboardCache: statsFor(this.leaderboardCache),
      protectionSettingsCache: statsFor(this.protectionSettingsCache),
      statsCache: statsFor(this.statsCache)
    };
  }
}

module.exports = new CacheManager();
