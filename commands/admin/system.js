const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const os = require('os');
const db = require('../../database/db');
const emojis = require('../../utils/emojis.json');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('system')
    .setDescription('عرض حالة النظام ومراقبة أداء البوت (للمشرفين فقط)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const client = interaction.client;

      // Calculate uptime
      const totalSeconds = Math.floor(client.uptime / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const uptimeStr = `${days} يوم، ${hours} ساعة، ${minutes} دقيقة، ${seconds} ثانية`;

      // Memory Usage
      const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const totalMemory = os.totalmem() / 1024 / 1024 / 1024;
      const freeMemory = os.freemem() / 1024 / 1024 / 1024;
      const systemUsedMemory = totalMemory - freeMemory;

      // Platform Info
      const platform = os.platform();
      const nodeVersion = process.version;

      // Database Status
      const dbStatus = db.client ? 'متصل 🟢' : 'غير متصل 🔴';

      const boltEmoji = emojis.bolt || '⚡';

      const embed = new EmbedBuilder()
        .setTitle(`${boltEmoji} مراقبة النظام والتشغيل`)
        .setColor(0x00ffcc)
        .addFields(
          {
            name: '🤖 حالة البوت',
            value: `**الاسم**: ${client.user.username}\n**مدة التشغيل**: ${uptimeStr}\n**سرعة الاستجابة**: ${client.ws.ping} ms`,
            inline: false
          },
          {
            name: '💾 استهلاك الذاكرة',
            value: `**العملية**: ${usedMemory.toFixed(2)} MB\n**النظام**: ${systemUsedMemory.toFixed(2)} GB / ${totalMemory.toFixed(2)} GB`,
            inline: true
          },
          {
            name: '💻 خادم الاستضافة',
            value: `**النظام**: ${platform}\n**الإصدار**: ${nodeVersion}\n**المعالج**: ${os.cpus().length} نواة`,
            inline: true
          },
          {
            name: '📊 إحصائيات عامة',
            value: `**السيرفرات**: ${client.guilds.cache.size}\n**المستخدمين**: ${client.users.cache.size}\n**الرومات الصوتية**: ${client.voiceSessions?.size || 0}`,
            inline: true
          },
          { name: '🗄️ قاعدة البيانات (MongoDB)', value: dbStatus, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('[Command Error - system.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء عرض إحصائيات النظام.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
