const db = require('../database/db');


async function sendLog(client, guildId, embed, type = null) {
  try {
    const settings = db.getLogSettings(guildId);
    if (!settings) return;

    const columnMap = {
      ban: 'ban_channel',
      unban: 'unban_channel',
      kick: 'kick_channel',
      timeout: 'timeout_channel',
      warn: 'warn_channel',
      message_delete: 'message_delete_channel',
      message_edit: 'message_edit_channel',
      member_join: 'member_join_channel',
      member_leave: 'member_leave_channel',
      channel_create: 'channel_create_channel',
      channel_delete: 'channel_delete_channel',
      role_create: 'role_create_channel',
      role_delete: 'role_delete_channel',
      nick_change: 'nick_change_channel'
    };

    const channelId = type ? settings[columnMap[type]] : null;
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send({ embeds: [embed] });
  } catch (e) {
  }
}

module.exports = { sendLog };
