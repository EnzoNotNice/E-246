const dailyCmd = require('./daily');

module.exports = {
  name: 'يومي',
  aliases: ['يومية'],
  async execute(message, args) {
    return await dailyCmd.execute(message, args);
  }
};
