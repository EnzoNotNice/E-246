const { ApplicationCommandOptionType } = require('discord.js');

async function createFakeInteraction(message, cmd, args) {
  const guild = message.guild;
  const client = message.client;
  
  const optionValues = {};
  let subcommandName = null;
  let optionDefs = cmd.data.options || [];

  // Check if first arg is a subcommand
  if (args.length > 0) {
    const firstArg = args[0].toLowerCase();
    const subcommandOpt = optionDefs.find(opt => opt.type === 1 && opt.name.toLowerCase() === firstArg);
    if (subcommandOpt) {
      subcommandName = subcommandOpt.name;
      optionDefs = subcommandOpt.options || [];
      args.shift(); // Remove subcommand name from args
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

    if (optType === 3) { // String
      // If it's the last option, consume the rest of args
      const isLast = optionDefs.indexOf(opt) === optionDefs.length - 1;
      if (isLast) {
        val = args.slice(argIndex).join(' ');
        argIndex = args.length;
      } else {
        argIndex++;
      }
      optionValues[optName] = val;
    } else if (optType === 4 || optType === 10) { // Integer or Number
      val = parseFloat(val);
      optionValues[optName] = isNaN(val) ? null : val;
      argIndex++;
    } else if (optType === 5) { // Boolean
      val = val.toLowerCase();
      optionValues[optName] = (val === 'true' || val === 'yes' || val === '1' || val === 'نعم');
      argIndex++;
    } else if (optType === 6) { // User
      const match = val.match(/^<@!?(\d+)>$/) || [null, val];
      const userId = match[1];
      const user = await client.users.fetch(userId).catch(() => null);
      optionValues[optName] = user;
      if (user) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        optionValues[optName + '_member'] = member;
      }
      argIndex++;
    } else if (optType === 7) { // Channel
      const match = val.match(/^<#(\d+)>$/) || [null, val];
      const channelId = match[1];
      const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      optionValues[optName] = channel;
      argIndex++;
    } else if (optType === 8) { // Role
      const match = val.match(/^<@&(\d+)>$/) || [null, val];
      const roleId = match[1];
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
      optionValues[optName] = role;
      argIndex++;
    } else {
      argIndex++;
    }
  }

  const optionsGetter = {
    getSubcommand() { return subcommandName; },
    getString(name) { return optionValues[name] || null; },
    getInteger(name) { return optionValues[name] || null; },
    getNumber(name) { return optionValues[name] || null; },
    getBoolean(name) { return optionValues[name] || null; },
    getUser(name) { return optionValues[name] || null; },
    getMember(name) {
      return optionValues[name + '_member'] || (optionValues[name] ? guild.members.cache.get(optionValues[name].id) : null) || null;
    },
    getChannel(name) { return optionValues[name] || null; },
    getRole(name) { return optionValues[name] || null; }
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
    options: optionsGetter,
    deferred: false,
    replied: false,
    
    async reply(payload) {
      if (this.replied || this.deferred) {
        throw new Error('Interaction already acknowledged.');
      }
      this.replied = true;
      if (typeof payload === 'string') payload = { content: payload };
      repliedMessage = await message.reply(payload).catch(() => null);
      return repliedMessage;
    },

    async deferReply(options = {}) {
      if (this.replied || this.deferred) {
        throw new Error('Interaction already acknowledged.');
      }
      this.deferred = true;
      repliedMessage = await message.reply({ content: '⏳ جاري التنفيذ...' }).catch(() => null);
      return repliedMessage;
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

    async followUp(payload) {
      if (typeof payload === 'string') payload = { content: payload };
      return message.reply(payload).catch(() => null);
    }
  };

  return fakeInteraction;
}

module.exports = { createFakeInteraction };
