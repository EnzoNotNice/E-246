const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const gameCommand = new SlashCommandBuilder().setName('game').setDescription('مجموعة ألعاب E-246 الجماعية والتفاعلية');

const games = new Map();

// Dynamically read and load all game subcommands in this directory
const files = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('.js') && f !== 'game.js' && f !== 'stopgame.js' && f !== 'bank.js');
for (const file of files) {
  try {
    const gameModule = require(path.join(__dirname, file));
    if (gameModule.subcommand && typeof gameModule.execute === 'function') {
      gameCommand.addSubcommand(gameModule.subcommand);
      games.set(gameModule.subcommand.name, gameModule);
    }
  } catch (err) {
    logger.error(`[game.js] Failed to load game subcommand file ${file}:`, err);
  }
}

module.exports = {
  data: gameCommand,
  execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gameModule = games.get(sub);
    if (gameModule) {
      return gameModule.execute(interaction);
    } else {
      return interaction.reply({ content: '❌ هذه اللعبة غير متوفرة حالياً', ephemeral: true }).catch(() => {});
    }
  }
};
