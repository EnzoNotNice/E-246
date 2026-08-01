module.exports = {
  // Global bot details
  botName: 'E-246',
  defaultPrefix: '#',
  embedColor: 0x8c52ff,
  successColor: 0x2ecc71,
  errorColor: 0xe74c3c,

  // Cooldown rate-limiting configuration
  cooldown: {
    durationMs: 2500, // 2.5 seconds الكول داون بين كل امر
    bypassRoles: [], // ايدي الرولات اللي تقدر تتجاوز الكول داون
    bypassUsers: [] // ايدي الاشخاص اللي تقدر تتجاوز الكول داون
  },

  // Backups configuration لاتعدل الا اذا كنت فاهم
  backup: {
    enabled: true,
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    retentionDays: 7
  },

  // Games settings لاتعدل
  games: require('./utils/gameConfig')
};
