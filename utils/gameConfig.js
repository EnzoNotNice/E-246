// Game Configuration Settings
// Centralized configuration for all game-related hardcoded values

module.exports = {
  // Bomb Game
  bomb: {
    maxPlayers: 15,
    minPlayers: 3,
    joinTime: 30000, // 30 seconds
    answerTime: 15000, // 15 seconds
    heartsPerPlayer: 2,
    startDelay: 5000, // 5 seconds
    roundDelay: 3000 // 3 seconds
  },

  // Chairs Game
  chairs: {
    maxPlayers: 20,
    minPlayers: 2,
    joinTime: 30000, // 30 seconds
    roundTime: 15000, // 15 seconds
    startDelay: 3000, // 3 seconds
    roundDelay: 3000, // 3 seconds
    trapProbability: 0.25, // 25% chance of trap round
    maxDisplayPlayers: 40
  },

  // Faster Game
  faster: {
    maxPlayers: 20,
    minPlayers: 2,
    joinTime: 30000, // 30 seconds
    answerTime: 15000, // 15 seconds
    totalRounds: 15,
    startDelay: 5000, // 5 seconds
    roundDelay: 3000 // 3 seconds
  },

  // Roulette Game
  roulette: {
    maxPlayers: 20,
    minPlayers: 2,
    joinTime: 30000, // 30 seconds
    actionTime: 30000, // 30 seconds
    startDelay: 3000, // 3 seconds
    gifDisplayTime: 2000 // 2 seconds
  },

  // Salfa Game
  salfa: {
    maxPlayers: 20,
    minPlayers: 4,
    joinTime: 30000, // 30 seconds
    voteTime: 45000, // 45 seconds
    guessTime: 20000, // 20 seconds
    startDelay: 5000, // 5 seconds
    roundDelay: 5000 // 5 seconds
  },

  // Mafia Game
  mafia: {
    maxPlayers: 12,
    minPlayers: 5,
    joinTime: 30000, // 30 seconds
    nightTime: 25000, // 25 seconds
    voteTime: 25000, // 25 seconds
    startDelay: 5000 // 5 seconds
  },

  // Button Game
  button: {
    rows: 4,
    cols: 5,
    totalButtons: 20,
    startDelay: 5000, // 5 seconds
    actionTime: 15000 // 15 seconds
  },

  // Default game settings
  defaults: {
    joinTime: 30000,
    minPlayers: 2,
    maxPlayers: 20
  }
};
