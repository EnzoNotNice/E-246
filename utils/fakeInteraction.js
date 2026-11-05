async function createFakeInteraction(message, cmd, args) {
  const guild = message.guild;
  const client = message.client;

  const optionValues = {};
  let subcommandName = null;
  const serialized = cmd.data.toJSON ? cmd.data.toJSON() : cmd.data;
  let optionDefs = serialized.options || [];

  if (args.length > 0) {
    const firstArg = args[0].toLowerCase();
    const subcommandOpt = optionDefs.find((opt) => opt.type === 1 && opt.name.toLowerCase() === firstArg);
    if (subcommandOpt) {
      subcommandName = subcommandOpt.name;
      optionDefs = subcommandOpt.options || [];
      args.shift();
    }
  }

  let argIndex = 0;
  for (const opt of optionDefs) {
    const optName = opt.name;
    const optType = opt.type;

    if (argIndex >= args.length) {
      optionValues[optName] = null;
      continue;
    }

    let val = args[argIndex];

    if (optType === 3) {
      const remainingOpts = optionDefs.slice(optionDefs.indexOf(opt) + 1);
      const hasMoreStrings = remainingOpts.some((o) => o.type === 3);

      if (!hasMoreStrings) {
        // Check if trailing arg is a number for a subsequent integer option (e.g. delete_messages in ban)
        const hasSubsequentInt = remainingOpts.some((o) => o.type === 4 || o.type === 10);
        const lastArg = args[args.length - 1];
        if (hasSubsequentInt && args.length - argIndex > 1 && /^\d+$/.test(lastArg)) {
          val = args.slice(argIndex, -1).join(' ');
          argIndex = args.length - 1;
        } else {
          val = args.slice(argIndex).join(' ');
          argIndex = args.length;
        }
      } else {
        argIndex++;
      }
      optionValues[optName] = val;
    } else if (optType === 4 || optType === 10) {
      let lowerVal = String(val).toLowerCase();
      if (optName === 'duration') {
        let dur = parseFloat(lowerVal);
        if (lowerVal.endsWith('m') || lowerVal.endsWith('د')) {
          dur = parseFloat(lowerVal.slice(0, -1));
        } else if (lowerVal.endsWith('h') || lowerVal.endsWith('س')) {
          dur = parseFloat(lowerVal.slice(0, -1)) * 60;
        } else if (lowerVal.endsWith('d') || lowerVal.endsWith('ي')) {
          dur = parseFloat(lowerVal.slice(0, -1)) * 1440;
        } else if (lowerVal.endsWith('w') || lowerVal.endsWith('أ')) {
          dur = parseFloat(lowerVal.slice(0, -1)) * 10080;
        }
        if (isNaN(dur)) {
          // If duration was omitted by user (e.g. "#mute @user spam"), default to 60m and keep arg for next option (reason)
          optionValues[optName] = 60;
        } else {
          optionValues[optName] = Math.floor(dur);
          argIndex++;
        }
      } else {
        let multiplier = 1;
        if (lowerVal === 'all' || lowerVal === 'كل' || lowerVal === 'الكل') {
          const db = require('../database/db');
          const userBalance = (await db.getKV(`balance_${message.author.id}`)) || 0;
          optionValues[optName] = userBalance;
        } else {
          if (lowerVal.endsWith('k')) {
            multiplier = 1000;
            lowerVal = lowerVal.slice(0, -1);
          } else if (lowerVal.endsWith('m')) {
            multiplier = 1000000;
            lowerVal = lowerVal.slice(0, -1);
          } else if (lowerVal.endsWith('b')) {
            multiplier = 1000000000;
            lowerVal = lowerVal.slice(0, -1);
          }

          const parsed = parseFloat(lowerVal) * multiplier;
          optionValues[optName] = isNaN(parsed) ? null : parsed;
        }
        argIndex++;
      }
    } else if (optType === 5) {
      val = val.toLowerCase();
      optionValues[optName] = val === 'true' || val === 'yes' || val === '1' || val === 'نعم';
      argIndex++;
    } else if (optType === 6) {
      const match = val.match(/^<@!?(\d+)>$/) || [null, val];
      const userId = match[1];
      const user = await client.users.fetch(userId).catch(() => null);
      optionValues[optName] = user;
      if (user) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        optionValues[optName + '_member'] = member;
      }
      argIndex++;
    } else if (optType === 7) {
      const match = val.match(/^<#(\d+)>$/) || [null, val];
      const channelId = match[1];
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      optionValues[optName] = channel;
      argIndex++;
    } else if (optType === 8) {
      const match = val.match(/^<@&(\d+)>$/) || [null, val];
      const roleId = match[1];
      const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
      optionValues[optName] = role;
      argIndex++;
    } else {
      argIndex++;
    }
  }

  const optionsGetter = {
    getSubcommand() {
      return subcommandName;
    },
    getString(name) {
      return optionValues[name] ?? null;
    },
    getInteger(name) {
      return optionValues[name] ?? null;
    },
    getNumber(name) {
      return optionValues[name] ?? null;
    },
    getBoolean(name) {
      return optionValues[name] ?? null;
    },
    getUser(name) {
      return optionValues[name] ?? null;
    },
    getMember(name) {
      return (
        optionValues[name + '_member'] ||
        (optionValues[name] ? guild.members.cache.get(optionValues[name].id) : null) ||
        null
      );
    },
    getChannel(name) {
      return optionValues[name] ?? null;
    },
    getRole(name) {
      return optionValues[name] ?? null;
    }
  };

  let repliedMessage = null;

  const fakeInteraction = {
    guild,
    guildId: guild.id,
    channel: message.channel,
    channelId: message.channel.id,
    user: message.author,
    member: message.member,
    client,
    commandName: cmd.data.name || serialized.name || '',
    options: optionsGetter,
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,

    async reply(payload) {
      if (this.replied || this.deferred) {
        throw new Error('Interaction already acknowledged.');
      }
      this.replied = true;
      if (typeof payload === 'string') payload = { content: payload };
      if (payload.fetchReply) delete payload.fetchReply;
      if (payload.withResponse) delete payload.withResponse;
      repliedMessage = await message.reply(payload).catch(() => null);
      return repliedMessage;
    },

    fetchReply() {
      return repliedMessage;
    },

    deferReply() {
      if (this.replied || this.deferred) {
        throw new Error('Interaction already acknowledged.');
      }
      this.deferred = true;
      return null;
    },

    async editReply(payload) {
      if (!repliedMessage) {
        if (typeof payload === 'string') payload = { content: payload };
        repliedMessage = await message.reply(payload).catch(() => null);
        return repliedMessage;
      }
      if (typeof payload === 'string') payload = { content: payload };
      if (payload.embeds && !payload.content) {
        payload.content = '';
      }
      await repliedMessage.edit(payload).catch(() => null);
      return repliedMessage;
    },

    followUp(payload) {
      if (typeof payload === 'string') payload = { content: payload };
      return message.reply(payload).catch(() => null);
    }
  };

  return fakeInteraction;
}

module.exports = { createFakeInteraction };
