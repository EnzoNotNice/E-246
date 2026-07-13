const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { sendLog } = require('../utils/logger');
const { handleLimit } = require('../utils/protectionAction');

module.exports = {
  name: Events.WebhooksUpdate,
  async execute(channel) {
    const guild = channel.guild;
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 }).catch(() => null);
    const entry = auditLogs ? auditLogs.entries.first() : null;

    if (entry && entry.target && entry.target.channelId === channel.id && entry.executor) {
      const diff = Date.now() - entry.createdTimestamp;
      if (diff < 15000) {
        const executor = entry.executor;
        if (executor.id !== guild.ownerId && !db.isWhitelisted(guild.id, executor.id) && executor.id !== guild.client.user.id) {
          const webhooks = await channel.fetchWebhooks().catch(() => null);
          if (webhooks) {
            const newWebhook = webhooks.find(w => w.id === entry.target.id);
            if (newWebhook) {
              await newWebhook.delete().catch(() => null);
            }
          }

          const exceeded = await handleLimit(guild, executor, 'webhook', 'webhook_limit', 'تجاوز حد الويبهوك');

          if (!exceeded) {
            const executorMember = await guild.members.fetch(executor.id).catch(() => null);
            if (executorMember) {
              await executorMember.roles.set([]).catch(() => null);
            }

            const embed = new EmbedBuilder()
              .setTitle('{emoji:shield} إنشاء ويبهوك غير مصرح به')
              .setColor(0xFF0000)
              .addFields(
                { name: '{emoji:folder} الروم', value: `<#${channel.id}>`, inline: true },
                { name: '{emoji:user} الفاعل', value: `<@${executor.id}>`, inline: true },
                { name: '{emoji:bolt} الإجراء', value: 'تم حذف الويبهوك وتجريد الرتب', inline: false }
              )
              .setTimestamp();
            await sendLog(guild.client, guild.id, embed, 'protection');
          }
        }
      }
    }
  }
};
