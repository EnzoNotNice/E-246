const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const db = require('../database/db');
const fs = require('fs');
const path = require('path');

function getEmojisJson() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'emojis.json'), 'utf8'));
}

function resolveEmoji(key, fallback) {
  const emojisJson = getEmojisJson();
  const val = emojisJson[key];
  if (!val) return fallback;
  const m = val.match(/<a?:(\w+):(\d+)>/);
  if (m) return `<${m[0].startsWith('<a:') ? 'a:' : ':'}${m[1]}:${m[2]}>`;
  return val;
}

function getCommandJson(cmd) {
  if (!cmd?.data) return null;
  return typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data;
}

function getRootOptions(json) {
  if (!json?.options) return [];
  return json.options.filter(
    (o) =>
      o.type !== ApplicationCommandOptionType.Subcommand &&
      o.type !== ApplicationCommandOptionType.SubcommandGroup &&
      o.type !== 1 &&
      o.type !== 2
  );
}

function hasRequiredOptions(cmd) {
  const json = getCommandJson(cmd);
  if (!json) return false;
  if ((json.options || []).some((o) => o.type === 1 || o.type === ApplicationCommandOptionType.Subcommand)) {
    return true;
  }
  return getRootOptions(json).some((o) => o.required);
}

function formatUsage(name, options) {
  const parts = options.map((o) => (o.required ? `[${o.name}]` : `(${o.name})`));
  return `/${name}${parts.length ? ' ' + parts.join(' ') : ''}`;
}

function formatExamples(name, options) {
  if (!options.length) return `\`/${name}\``;
  const lines = [];
  const first = options[0];
  if (first.type === ApplicationCommandOptionType.User || first.type === 6) {
    lines.push(`\`/${name} @User\``);
    lines.push(`\`/${name} 467733205605416970\``);
  } else if (first.type === ApplicationCommandOptionType.Channel || first.type === 7) {
    lines.push(`\`/${name} #channel\``);
  } else if (first.type === ApplicationCommandOptionType.Role || first.type === 8) {
    lines.push(`\`/${name} @Role\``);
  } else {
    lines.push(`\`/${name} ${first.name}\``);
  }
  if (options.length > 1) {
    const sample = options
      .map((o) => {
        if (o.type === 6 || o.type === ApplicationCommandOptionType.User) return '@User';
        if (o.type === 3 || o.type === ApplicationCommandOptionType.String) return o.required ? 'نص' : '';
        return o.name;
      })
      .filter(Boolean)
      .join(' ');
    if (sample) lines.push(`\`/${name} ${sample}\``);
  }
  return [...new Set(lines)].slice(0, 4).join('\n');
}

function getAliasesForCommand(guildId, commandName, prefix = '#') {
  const name = String(commandName).toLowerCase();
  const list = db.getAliases(guildId) || [];
  const aliases = list
    .filter((a) => {
      const base = String(a.command || '')
        .trim()
        .split(/ +/)[0]
        .toLowerCase()
        .replace(/^\//, '');
      return base === name;
    })
    .map((a) => {
      let s = String(a.shortcut || '');
      if (prefix && s.startsWith(prefix)) s = s.slice(prefix.length);
      return s;
    })
    .filter(Boolean);
  return [...new Set(aliases)];
}

function buildCommandHelpEmbed(cmd, guildId, prefix = '#') {
  const json = getCommandJson(cmd);
  const name = json?.name || cmd?.data?.name || 'unknown';
  const description = json?.description || cmd?.data?.description || '—';
  const options = getRootOptions(json || {});
  const aliases = getAliasesForCommand(guildId, name, prefix);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${resolveEmoji('list', '📋')} Command: \`${name}\``)
    .setDescription(description)
    .addFields(
      {
        name: `${resolveEmoji('bolt', '⚡')} Aliases`,
        value: aliases.length ? aliases.map((a) => `\`${a}\``).join(', ') : 'لا توجد اختصارات',
        inline: false
      },
      {
        name: `${resolveEmoji('settings', '⚙️')} Usage`,
        value: `\`${formatUsage(name, options)}\``,
        inline: false
      },
      {
        name: `${resolveEmoji('star', '⭐')} Examples`,
        value: formatExamples(name, options),
        inline: false
      }
    )
    .setTimestamp();

  return embed;
}

function shouldShowCommandHelp(cmd, args) {
  if (!cmd) return false;
  if (Array.isArray(args) && args.length > 0) return false;
  return hasRequiredOptions(cmd);
}

module.exports = {
  buildCommandHelpEmbed,
  getAliasesForCommand,
  hasRequiredOptions,
  shouldShowCommandHelp,
  formatUsage,
  formatExamples
};
