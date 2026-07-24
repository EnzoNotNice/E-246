require('dotenv').config();
require('./utils/env-config');

if (!process.env.FONTCONFIG_PATH && !process.env.FONTCONFIG_FILE) {
  const fc = pathJoinSafeFontconfig();
  if (fc) {
    process.env.FONTCONFIG_PATH = fc.dir;
    process.env.FONTCONFIG_FILE = fc.file;
  }
}

require('./utils/emojiReplacer');
require('./utils/replyInterceptor');
require('dns').setDefaultResultOrder('ipv4first');

function pathJoinSafeFontconfig() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, 'assets', 'fontconfig');
    const conf = path.join(dir, 'fonts.conf');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(conf)) {
      fs.writeFileSync(
        conf,
        `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${path.join(__dirname, 'assets', 'fonts').replace(/&/g, '&amp;')}</dir>
  <dir>${path.join(__dirname, 'assets').replace(/&/g, '&amp;')}</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
</fontconfig>
`
      );
    }
    return { dir, file: conf };
  } catch {
    return null;
  }
}

const https = require('https');
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    https.globalAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
    console.log(`[Proxy] Outbound HTTPS proxy configured successfully: ${process.env.HTTPS_PROXY}`);
  } catch (err) {
    console.error('[Proxy] Failed to configure global HTTPS proxy:', err.message);
  }
}
const { Client, GatewayIntentBits, Collection, Partials, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
});

client.commands = new Collection();
client.prefixCommands = new Collection();
client.inviteCache = new Map();
client.voiceSessions = new Map();

const { setupMusic } = require('./utils/music');
setupMusic(client);

const ACTIVE_COMMAND_DIRS = ['admin', 'greet', 'invite', 'levels', 'protection', 'giveaway', 'automation', 'ticket', 'public', 'games', 'utils', 'music'];

for (const dir of ACTIVE_COMMAND_DIRS) {
  const dirPath = path.join(__dirname, 'commands', dir);
  if (!fs.existsSync(dirPath)) continue;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(dirPath, file));
    if (cmd.data && cmd.execute) {
      const name = cmd.data.name;
      if (client.commands.has(name)) {
        const existing = client.commands.get(name);
        console.warn(
          `[Commands] Duplicate slash name "/${name}" — skipping ${dir}/${file} (kept ${existing.category || '?'})`
        );
        continue;
      }
      cmd.category = dir;
      client.commands.set(name, cmd);
      console.log(`Loaded slash: ${name} (${dir})`);
    }
  }
}

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const commandsJson = [];
const seenDeployNames = new Set();
for (const [name, cmd] of client.commands) {
  if (seenDeployNames.has(name)) continue;
  seenDeployNames.add(name);
  commandsJson.push(cmd.data.toJSON());
}

async function deploySlashCommands(client) {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID || client?.user?.id;
  if (!token || !clientId) {
    console.error('[Deploy] Missing DISCORD_TOKEN or CLIENT_ID — skip slash deploy');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const guildId = process.env.GUILD_ID?.trim();

  const putGlobal = async (body) => {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`[Deploy] Set ${body.length} global commands`);
  };

  const putGuild = async (id, body) => {
    await rest.put(Routes.applicationGuildCommands(clientId, id), { body });
    console.log(`[Deploy] Set ${body.length} guild commands for ${id}`);
  };

  const clearGuildCommands = async (id) => {
    try {
      await putGuild(id, []);
    } catch (e) {
      if (e.code !== 50001 && e.status !== 403) {
        console.warn(`[Deploy] Could not clear guild ${id} commands:`, e.message || e);
      }
    }
  };

  const clearAllGuildCommands = async () => {
    const guilds = client?.guilds?.cache;
    if (!guilds?.size) return;
    for (const id of guilds.keys()) {
      await clearGuildCommands(id);
    }
  };

  try {
    if (guildId) {
      const inGuild = client?.guilds?.cache?.has(guildId);
      if (!inGuild) {
        console.warn(`[Deploy] GUILD_ID=${guildId} is not a guild this bot is in — using global deploy`);
        await putGlobal(commandsJson);
        await clearAllGuildCommands();
        return;
      }
      try {
        await putGuild(guildId, commandsJson);
        // Clear global so Discord does not show each command twice (guild + global)
        await putGlobal([]);
        for (const id of client.guilds.cache.keys()) {
          if (id !== guildId) await clearGuildCommands(id);
        }
      } catch (guildErr) {
        if (guildErr.code === 50001 || guildErr.status === 403) {
          console.warn(
            `[Deploy] Missing Access for guild ${guildId} (re-invite bot with scope applications.commands). Falling back to global.`
          );
          await putGlobal(commandsJson);
          await clearAllGuildCommands();
          return;
        }
        throw guildErr;
      }
    } else {
      await putGlobal(commandsJson);
      // Clear any leftover guild-scoped commands that cause duplicates in /
      await clearAllGuildCommands();
    }
  } catch (error) {
    console.error('[Deploy] Failed to auto-deploy commands:', error.code || '', error.message || error);
  }
}

client.deploySlashCommands = deploySlashCommands;
client.once(Events.ClientReady, () => {
  deploySlashCommands(client).catch((e) => console.error('[Deploy]', e.message || e));
});

const prefixDir = path.join(__dirname, 'commands', 'prefix');
if (fs.existsSync(prefixDir)) {
  const files = fs.readdirSync(prefixDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(prefixDir, file));
    if (cmd.name && cmd.execute) {
      client.prefixCommands.set(cmd.name, cmd);
      console.log(`Loaded prefix: ${cmd.name}`);
    }
  }
}

const eventsDir = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsDir, file));
  if (event.name && typeof event.execute === 'function') {
    const handler = async (...args) => {
      try {
        await event.execute(...args);
      } catch (err) {
        console.error(`Error in event ${event.name}:`, err);
      }
    };
    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
    console.log(`Loaded event: ${event.name}`);
  }
}

process.on('unhandledRejection', err => {
  console.error('[Unhandled Rejection]', err);
});

process.on('uncaughtException', err => {
  console.error('[Uncaught Exception]', err);
});

(async () => {
  try {
    const db = require('./database/db');
    try {
      await db.connect();
    } catch (error) {
      console.error('⚠️ MongoDB connection failed, continuing without database:', error.message);
    }

    require('./dashboard/server')(client);
    client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
})();
