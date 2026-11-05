const dailyCmd = require('./daily');

module.exports = {
  name: 'راتب',
  aliases: ['salary'],
  async execute(message, args) {
    return await dailyCmd.execute(message, args);
  }
};
