const channelIdCache = new Map();

function extractChannelIdFromHtml(html) {
  if (!html || typeof html !== 'string') return null;
  const match =
    html.match(/"channelId":"(UC[\w-]{20,})"/) ||
    html.match(/channel_id=(UC[\w-]{20,})/) ||
    html.match(/\/channel\/(UC[\w-]{20,})/);
  return match && match[1] ? match[1] : null;
}

function parseYouTubeInput(input) {
  if (!input) return { kind: 'empty', value: null };
  const raw = String(input).trim();
  if (/^UC[\w-]{20,}$/.test(raw)) return { kind: 'id', value: raw, raw };
  if (raw.includes('youtube.com/channel/')) {
    const id = raw.split('youtube.com/channel/')[1].split(/[/?#]/)[0];
    if (/^UC[\w-]{20,}$/.test(id)) return { kind: 'id', value: id, raw };
  }
  let handle = null;
  if (raw.includes('youtube.com/@')) {
    handle = raw.split('youtube.com/@')[1].split(/[/?#]/)[0];
  } else if (raw.startsWith('@')) {
    handle = raw.slice(1).split(/[/?#]/)[0];
  } else if (!raw.includes('/') && !raw.startsWith('UC')) {
    handle = raw.replace(/^@/, '');
  }
  if (handle) return { kind: 'handle', value: handle, raw };
  return { kind: 'unknown', value: raw, raw };
}

async function resolveYouTubeChannelId(input, fetchImpl = globalThis.fetch) {
  if (!input) return null;
  const raw = String(input).trim();
  if (channelIdCache.has(raw)) return channelIdCache.get(raw);

  const parsed = parseYouTubeInput(raw);
  if (parsed.kind === 'id') {
    channelIdCache.set(raw, parsed.value);
    return parsed.value;
  }

  if (parsed.kind === 'handle' && typeof fetchImpl === 'function') {
    try {
      const res = await fetchImpl(`https://www.youtube.com/@${encodeURIComponent(parsed.value)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res && res.ok) {
        const html = await res.text();
        const id = extractChannelIdFromHtml(html);
        if (id) {
          channelIdCache.set(raw, id);
          return id;
        }
      }
    } catch (_) {
      return null;
    }
  }

  return null;
}

function isValidYouTubeChannelId(id) {
  return typeof id === 'string' && /^UC[\w-]{20,}$/.test(id);
}

function clearYouTubeResolveCache() {
  channelIdCache.clear();
}

module.exports = {
  resolveYouTubeChannelId,
  parseYouTubeInput,
  extractChannelIdFromHtml,
  isValidYouTubeChannelId,
  clearYouTubeResolveCache
};
