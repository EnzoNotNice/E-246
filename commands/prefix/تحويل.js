const creditsCmd = require('./credits');

module.exports = {
  name: 'تحويل',
  aliases: ['transfer'],
  async execute(message, args) {
    return await creditsCmd.execute(message, args);
  }
};
