const { ShardingManager } = require('discord.js');
const path = require('path');
require('dotenv').config({ quiet: true });
const logger = require('./utils/logger');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  logger.error('[Sharding] DISCORD_TOKEN is missing from .env! Cannot spawn shards.');
  process.exit(1);
}

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
  token: token,
  totalShards: 'auto',
  respawn: true
});

manager.on('shardCreate', (shard) => {
  logger.info(`[Sharding] 🚀 Launched shard #${shard.id}`);

  shard.on('ready', () => {
    logger.info(`[Sharding] ✅ Shard #${shard.id} is connected and ready.`);
  });

  shard.on('disconnect', () => {
    logger.warn(`[Sharding] ⚠️ Shard #${shard.id} disconnected.`);
  });

  shard.on('reconnecting', () => {
    logger.info(`[Sharding] 🔄 Shard #${shard.id} reconnecting...`);
  });

  shard.on('death', (process) => {
    logger.error(`[Sharding] ❌ Shard #${shard.id} process died with exit code ${process.exitCode}`);
  });
});

manager
  .spawn()
  .then((shards) => {
    logger.info(`[Sharding] Successfully spawned ${shards.size} shard(s) across Discord Gateway.`);
  })
  .catch((err) => {
    logger.error('[Sharding] Error spawning shards:', err);
  });

process.on('SIGINT', () => {
  logger.info('[Sharding] Received SIGINT. Shutting down shards gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('[Sharding] Received SIGTERM. Shutting down shards gracefully...');
  process.exit(0);
});
