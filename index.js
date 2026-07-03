require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
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

const ACTIVE_COMMAND_DIRS = ['admin', 'greet', 'invite', 'levels', 'protection', 'giveaway', 'automation', 'ticket', 'public', 'games', 'utils'];

for (const dir of ACTIVE_COMMAND_DIRS) {
  const dirPath = path.join(__dirname, 'commands', dir);
  if (!fs.existsSync(dirPath)) continue;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(dirPath, file));
    if (cmd.data && cmd.execute) {
      cmd.category = dir;
      client.commands.set(cmd.data.name, cmd);
      console.log(`Loaded slash: ${cmd.data.name} (${dir})`);
    }
  }
}

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const commandsJson = [];
for (const [_, cmd] of client.commands) {
  commandsJson.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commandsJson }
      );
      console.log(`Auto-deployed ${commandsJson.length} commands to guild ${guildId}`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandsJson }
      );
      console.log(`Auto-deployed ${commandsJson.length} commands globally`);
    }
  } catch (error) {
    console.error('Failed to auto-deploy commands:', error);
  }
})();

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
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`Loaded event: ${event.name}`);
}

process.on('unhandledRejection', err => {
  console.error('[Unhandled Rejection]', err);
});

process.on('uncaughtException', err => {
  console.error('[Uncaught Exception]', err);
});

require('./dashboard/server')(client);

client.login(process.env.DISCORD_TOKEN);
