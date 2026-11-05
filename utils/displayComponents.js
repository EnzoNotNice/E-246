const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  FileBuilder,
  ActionRowBuilder,
  ActionRow,
  MessageFlags,
  MessageFlagsBitField,
  EmbedBuilder
} = require('discord.js');

const MAX_TEXT_LENGTH = 4000;

/**
 * Truncate a string safely to prevent hitting Discord's 4000 character limit.
 */
function safeText(str, maxLength = 2000) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength - 3) + '...';
  }
  return trimmed;
}

/**
 * Convert an Embed (or embed-like object) into a Discord ContainerBuilder (Components V2).
 *
 * @param {EmbedBuilder|Object} embedData
 * @param {Array} [actionRows=[]] Any ActionRow components to include
 * @param {Array} [files=[]] Attached files to reference
 * @returns {ContainerBuilder}
 */
function convertEmbedToContainer(embedData, actionRows = [], files = []) {
  if (!embedData) return null;
  const raw = embedData instanceof EmbedBuilder ? embedData.toJSON() : embedData;
  const container = new ContainerBuilder();

  // 1. Accent Color
  if (raw.color) {
    container.setAccentColor(raw.color);
  }

  // 2. Author info (if present, rendered as small markdown header at top)
  if (raw.author && raw.author.name) {
    const authorText = safeText(raw.author.icon_url ? `${raw.author.name}` : `${raw.author.name}`, 250);
    if (authorText) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${authorText}**`));
    }
  }

  // 3. Title & Thumbnail
  const title = safeText(raw.title, 256);
  const description = safeText(raw.description, 3000);
  const hasThumbnail = raw.thumbnail && raw.thumbnail.url;

  if (hasThumbnail) {
    // When thumbnail is present, use a Section with ThumbnailAccessory
    const section = new SectionBuilder();
    let textCount = 0;

    if (title) {
      section.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
      textCount++;
    }

    if (description && textCount < 3) {
      section.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
      textCount++;
    }

    // A Section MUST have at least one text display component and an accessory
    if (textCount === 0) {
      section.addTextDisplayComponents(new TextDisplayBuilder().setContent('‎'));
    }

    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(raw.thumbnail.url));
    container.addSectionComponents(section);
  } else {
    // Standard layout without thumbnail
    if (title) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
    }
    if (description) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
    }
  }

  // 4. Fields
  if (Array.isArray(raw.fields) && raw.fields.length > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    for (const field of raw.fields) {
      const fName = safeText(field.name, 256);
      const fValue = safeText(field.value, 1024);
      if (fName && fValue) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${fName}**\n${fValue}`));
      }
    }
  }

  // 5. Image or referenced media attachment
  if (raw.image && raw.image.url) {
    container.addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(raw.image.url)));
  }

  // 6. Automatically reference attached files if not already referenced
  if (Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      const fileName = file.name || (typeof file === 'string' ? file.split(/[/\\]/).pop() : null);
      if (fileName) {
        const fileUrl = `attachment://${fileName}`;
        const isImage = /\.(png|jpe?g|gif|webp)$/i.test(fileName);
        if (isImage) {
          container.addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(fileUrl)));
        } else {
          container.addFileComponents((f) => f.setURL(fileUrl));
        }
      }
    }
  }

  // 7. Footer & Timestamp
  const footerParts = [];
  if (raw.footer && raw.footer.text) {
    footerParts.push(safeText(raw.footer.text, 256));
  }
  if (raw.timestamp) {
    const ts = Math.floor(new Date(raw.timestamp).getTime() / 1000);
    if (!isNaN(ts)) {
      footerParts.push(`<t:${ts}:R>`);
    }
  }
  if (footerParts.length > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footerParts.join(' • ')}`));
  }

  // 8. Add any interactive action rows inside the container (if explicitly provided)
  if (Array.isArray(actionRows)) {
    for (const row of actionRows) {
      if (row) {
        container.addActionRowComponents(row);
      }
    }
  }

  // Ensure container is never completely empty
  if (!container.components || container.components.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('‎'));
  }

  return container;
}

/**
 * Universal payload converter that transforms standard Discord message options
 * (with embeds, content, buttons, attachments) into a compliant Components V2 payload.
 *
 * @param {Object|string} options The message payload options
 * @returns {Object} Transformed options ready for Discord API
 */
function toDisplayComponents(options) {
  if (!options) return options;
  if (typeof options === 'string') {
    options = { content: options };
  }

  // Extract components (e.g. ActionRows with buttons/select menus)
  const actionRows = [];
  const existingContainers = [];
  if (Array.isArray(options.components)) {
    for (const c of options.components) {
      if (!c) continue;
      if (c instanceof ContainerBuilder || c.type === 17) {
        existingContainers.push(c);
      } else {
        const isActionRow = c instanceof ActionRowBuilder || c instanceof ActionRow || c.type === 1;
        if (isActionRow) {
          try {
            actionRows.push(c instanceof ActionRowBuilder ? c : ActionRowBuilder.from(c.toJSON ? c.toJSON() : c));
          } catch (e) {
            actionRows.push(c);
          }
        }
      }
    }
  }

  const files = Array.isArray(options.files) ? options.files : [];
  const containers = [];

  // Convert embeds into containers (WITHOUT nesting actionRows inside!)
  if (Array.isArray(options.embeds) && options.embeds.length > 0) {
    for (const emb of options.embeds) {
      const container = convertEmbedToContainer(emb, [], files);
      if (container) {
        containers.push(container);
      }
    }
  } else if (typeof options.content === 'string' && options.content.trim().length > 0) {
    // If no embeds, wrap text content into a sleek ContainerBuilder
    const container = new ContainerBuilder().setAccentColor(0x5865f2);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(safeText(options.content, MAX_TEXT_LENGTH)));

    // Reference any attachments
    if (files.length > 0) {
      for (const file of files) {
        const fileName = file.name || (typeof file === 'string' ? file.split(/[/\\]/).pop() : null);
        if (fileName) {
          const fileUrl = `attachment://${fileName}`;
          const isImage = /\.(png|jpe?g|gif|webp)$/i.test(fileName);
          if (isImage) {
            container.addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(fileUrl)));
          } else {
            container.addFileComponents((f) => f.setURL(fileUrl));
          }
        }
      }
    }
    containers.push(container);
  }

  // When new embeds/content are provided, they REPLACE the existing container(s)
  const allContainers = containers.length > 0 ? containers : existingContainers;

  if (allContainers.length > 0) {
    // If there was text content alongside embeds, preserve it at the top of the primary container
    if (
      Array.isArray(options.embeds) &&
      options.embeds.length > 0 &&
      typeof options.content === 'string' &&
      options.content.trim().length > 0
    ) {
      allContainers[0].spliceComponents(0, 0, new TextDisplayBuilder().setContent(safeText(options.content, 2000)));
    }

    // Opt-in to Components V2 flags safely with MessageFlagsBitField
    let bitfield;
    try {
      bitfield = new MessageFlagsBitField(options.flags || 0);
    } catch (e) {
      bitfield = new MessageFlagsBitField();
    }
    bitfield.add(MessageFlags.IsComponentsV2);
    if (options.ephemeral) {
      bitfield.add(MessageFlags.Ephemeral);
    }
    options.flags = bitfield.bitfield;

    // Under Components V2: cannot send content or embeds
    options.content = null;
    options.embeds = [];
    // Keep containers first, followed by top-level ActionRows (buttons, select menus)
    options.components = [...allContainers, ...actionRows];
  } else if (actionRows.length > 0) {
    options.components = actionRows;
  }

  return options;
}

/**
 * Check if a message options object is using Components V2.
 */
function isComponentsV2(options) {
  if (!options || typeof options !== 'object') return false;
  if (options.flags !== undefined && options.flags !== null) {
    try {
      const bitfield = new MessageFlagsBitField(options.flags);
      return bitfield.has(MessageFlags.IsComponentsV2);
    } catch (e) {
      return false;
    }
  }
  return false;
}

module.exports = {
  convertEmbedToContainer,
  toDisplayComponents,
  isComponentsV2,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  FileBuilder
};
