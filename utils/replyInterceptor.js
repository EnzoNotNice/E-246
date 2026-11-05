const {
  CommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  ActionRowBuilder,
  ActionRow,
  Message,
  User,
  GuildMember,
  WebhookClient,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  DMChannel,
  VoiceChannel,
  StageChannel,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');
const logger = require('./logger');
const { toDisplayComponents, isComponentsV2 } = require('./displayComponents');

function convertEmbedsToText(options) {
  if (!options) return options;

  if (typeof options === 'string') {
    options = { content: options };
  }

  let embeds = [];
  if (options.embeds) {
    embeds = options.embeds;
  }

  if (!embeds || embeds.length === 0) return options;

  let plainText = '';
  for (const embedData of embeds) {
    const embed = embedData instanceof EmbedBuilder ? embedData.data : embedData;
    if (!embed) continue;

    const parts = [];
    if (embed.title) parts.push(`**${embed.title}**`);
    if (embed.description) parts.push(embed.description);
    if (embed.fields) {
      for (const f of embed.fields) {
        parts.push(`**${f.name}**\n${f.value}`);
      }
    }
    if (embed.footer?.text) parts.push(`_${embed.footer.text}_`);

    if (parts.length > 0) {
      plainText += parts.join('\n\n') + '\n\n';
    }
  }

  if (plainText.trim()) {
    options.content = (options.content ? options.content + '\n\n' : '') + plainText.trim();
    delete options.embeds;
  }

  return options;
}

function processReplyOptions(options, guildId) {
  if (!options) return options;

  // Already converted to Components V2 and has no leftover raw embeds? Pass through
  if (isComponentsV2(options) && (!options.embeds || options.embeds.length === 0)) return options;

  // Normalize raw embed inputs
  if (
    options instanceof EmbedBuilder ||
    (options && options.data && (options.data.title || options.data.description))
  ) {
    options = { embeds: [options] };
  } else if (Array.isArray(options)) {
    options = { embeds: options };
  } else if (typeof options === 'string') {
    options = { content: options };
  } else if (options && typeof options === 'object' && options.embed && !options.embeds) {
    options.embeds = [options.embed];
    delete options.embed;
  }

  try {
    let replyType = 'components_v2';
    if (guildId) {
      const settings = db.getGuildSettings(guildId);
      if (settings && settings.reply_type) {
        replyType = settings.reply_type;
      }
    }

    // Only fallback to plain text if the server explicitly configured normal text mode
    if (replyType === 'normal') {
      return convertEmbedsToText(options);
    }

    // Standard Discord Embeds mode
    if (replyType === 'embed') {
      return options;
    }

    // Default: Display Components V2
    if ((Array.isArray(options.embeds) && options.embeds.length > 0) || replyType === 'components_v2') {
      return toDisplayComponents(options);
    }
  } catch (err) {
    logger.error('[ReplyInterceptor] Error formatting reply options:', err);
  }

  return options;
}

function prepareUpdateOptions(interaction, options) {
  if (options && typeof options === 'object') {
    // If options.components is undefined (not explicitly provided), preserve existing ActionRows from the message
    if (options.components === undefined && interaction?.message?.components) {
      const existingRows = interaction.message.components.filter(
        (c) => c && (c.type === 1 || c instanceof ActionRowBuilder || c instanceof ActionRow)
      );
      if (existingRows.length > 0) {
        options.components = existingRows.map((r) => {
          try {
            return ActionRowBuilder.from(r.toJSON ? r.toJSON() : r);
          } catch (e) {
            return r;
          }
        });
      }
    }
  }

  return processReplyOptions(options, interaction?.guildId || interaction?.guild?.id);
}

// 1. Hook CommandInteraction (Slash commands replies, deferrals, edits)
const origInteractionReply = CommandInteraction.prototype.reply;
const origInteractionEditReply = CommandInteraction.prototype.editReply;
const origInteractionFollowUp = CommandInteraction.prototype.followUp;

CommandInteraction.prototype.reply = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origInteractionReply.call(this, options);
};

CommandInteraction.prototype.editReply = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origInteractionEditReply.call(this, options);
};

CommandInteraction.prototype.followUp = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origInteractionFollowUp.call(this, options);
};

// 2. Hook MessageComponentInteraction (Buttons and Select Menus: String, User, Role, Channel, Mentionable)
const origComponentReply = MessageComponentInteraction.prototype.reply;
const origComponentEditReply = MessageComponentInteraction.prototype.editReply;
const origComponentFollowUp = MessageComponentInteraction.prototype.followUp;
const origComponentUpdate = MessageComponentInteraction.prototype.update;

MessageComponentInteraction.prototype.reply = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origComponentReply.call(this, options);
};

MessageComponentInteraction.prototype.editReply = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origComponentEditReply.call(this, options);
};

MessageComponentInteraction.prototype.followUp = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origComponentFollowUp.call(this, options);
};

MessageComponentInteraction.prototype.update = function (options) {
  options = prepareUpdateOptions(this, options);
  return origComponentUpdate.call(this, options);
};

// 3. Hook ModalSubmitInteraction (Modal submissions)
const origModalReply = ModalSubmitInteraction.prototype.reply;
const origModalEditReply = ModalSubmitInteraction.prototype.editReply;
const origModalFollowUp = ModalSubmitInteraction.prototype.followUp;
const origModalUpdate = ModalSubmitInteraction.prototype.update;

ModalSubmitInteraction.prototype.reply = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origModalReply.call(this, options);
};

ModalSubmitInteraction.prototype.editReply = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origModalEditReply.call(this, options);
};

ModalSubmitInteraction.prototype.followUp = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origModalFollowUp.call(this, options);
};

if (typeof origModalUpdate === 'function') {
  ModalSubmitInteraction.prototype.update = function (options) {
    options = prepareUpdateOptions(this, options);
    return origModalUpdate.call(this, options);
  };
}

// 2. Hook Message.prototype.reply and Message.prototype.edit (Prefix commands)
const origMessageReply = Message.prototype.reply;
Message.prototype.reply = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origMessageReply.call(this, options);
};

const origMessageEdit = Message.prototype.edit;
Message.prototype.edit = function (options) {
  options = processReplyOptions(options, this.guildId || this.guild?.id);
  return origMessageEdit.call(this, options);
};

// 3. Hook Channel sends across all Discord channel types
const channelClasses = [TextChannel, NewsChannel, ThreadChannel, DMChannel, VoiceChannel, StageChannel];
for (const cls of channelClasses) {
  if (cls && cls.prototype && typeof cls.prototype.send === 'function') {
    const origSend = cls.prototype.send;
    cls.prototype.send = function (options) {
      options = processReplyOptions(options, this.guildId || this.guild?.id);
      return origSend.call(this, options);
    };
  }
}

// 4. Hook User and Member direct message sends (DMs)
const userClasses = [User, GuildMember];
for (const cls of userClasses) {
  if (cls && cls.prototype && typeof cls.prototype.send === 'function') {
    const origSend = cls.prototype.send;
    cls.prototype.send = function (options) {
      options = processReplyOptions(options, this.guild?.id);
      return origSend.call(this, options);
    };
  }
}

// 5. Hook WebhookClient sends (Audit logs, transcripts)
if (WebhookClient && WebhookClient.prototype && typeof WebhookClient.prototype.send === 'function') {
  const origWebhookSend = WebhookClient.prototype.send;
  WebhookClient.prototype.send = function (options) {
    options = processReplyOptions(options);
    return origWebhookSend.call(this, options);
  };
}

logger.info(
  '[ReplyInterceptor] Universal Display Components V2 hooks initialized across all Discord interactions, messages, channels, DMs, and webhooks.'
);

module.exports = {
  processReplyOptions,
  prepareUpdateOptions,
  convertEmbedsToText
};
