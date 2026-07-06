const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { sendLog } = require('../utils/logger');

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

          const executorMember = await guild.members.fetch(executor.id).catch(() => null);
          if (executorMember) {
            await executorMember.roles.set([]).catch(() => null);
          }

          const embed = new EmbedBuilder()
            .setTitle('{emoji:shield} إنشاء ويبهوك غير مصرح به')
            .setColor(0xFF0000)
            .addFields(
              { name: 'الروم', value: `<#${channel.id}>`, inline: true },
              { name: 'الفاعل (المشرف)', value: `<@${executor.id}>`, inline: true },
              { name: 'الإجراء المتخذ', value: 'تم حذف الويبهوك فوراً، وتجريد المشرف من كافة رتبه', inline: false }
            )
            .setTimestamp();
          await sendLog(guild.client, guild.id, embed, 'protection');
        }
      }
    }
  }
};
