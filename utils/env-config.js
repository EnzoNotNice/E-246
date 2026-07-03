const fs = require('fs');
const path = require('path');
const logger = require('winston');

class EnvConfig {
  constructor() {
    this.schema = {
      DISCORD_TOKEN: { required: true, type: 'string' },
      CLIENT_ID: { required: true, type: 'string', pattern: /^\d+$/ },
      CLIENT_SECRET: { required: true, type: 'string' },
      PORT: { type: 'number', min: 1, max: 65535, default: 3000 },
      CALLBACK_URL: { type: 'string', pattern: /^https?:\/\// },
      SESSION_SECRET: { required: true, type: 'string', minLength: 32 },
      RATE_LIMIT_WINDOW_MS: { type: 'number', min: 1000, default: 60000 },
      RATE_LIMIT_MAX_REQUESTS: { type: 'number', min: 1, default: 100 },
      LOG_LEVEL: { type: 'string', enum: ['error', 'warn', 'info', 'debug'], default: 'info' },
      GUILD_ID: { type: 'string', pattern: /^\d+$/ }
    };
    this.validate();
    this.load();
  }

  validate() {
    const env = process.env;
    const errors = [];

    for (const [key, rules] of Object.entries(this.schema)) {
      const value = env[key];

      if (rules.required && (!value || value.trim() === '')) {
        errors.push(`Missing required environment variable: ${key}`);
        continue;
      }

      if (!value) continue;

      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`Invalid format for ${key}. Expected pattern: ${rules.pattern.source}`);
      }

      if (rules.type === 'number' && isNaN(parseFloat(value))) {
        errors.push(`Invalid number type for ${key}: ${value}`);
      }
    }

    if (errors.length > 0) {
      console.error('\n=== Environment Validation Errors ===');
      errors.forEach((err, i) => console.error(`${i + 1}. ${err}`));
      console.error('\nPlease update your .env file and try again.\n');
      process.exit(1);
    }

    logger.info('Environment validation passed');
  }

  load() {
    Object.entries(this.schema).forEach(([key, rules]) => {
      if (rules.required && process.env[key]) {
        process.env[key] = process.env[key].trim();
      }

      if (rules.default && !process.env[key]) {
        process.env[key] = rules.default;
        logger.info(`Using default value for ${key}: ${rules.default}`);
      }
    });
  }
}

module.exports = new EnvConfig();
