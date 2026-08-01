const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  name: 'محفظة',
  aliases: ['wallet', 'فلوس', 'balance', 'money'],
  async execute(message) {
    try {
      const guildSettings = db.getGuildSettings(message.guild.id);
      const bankChannelId = guildSettings ? guildSettings.bank_channel : null;
      if (bankChannelId && message.channel.id !== bankChannelId) {
        return message
          .reply({ content: `{emoji:circlex} لا يمكنك استخدام أوامر البنك خارج الروم المخصص: <#${bankChannelId}>` })
          .catch(() => null);
      }

      const userId = message.author.id;
      const userBalance = (await db.getKV(`balance_${userId}`)) || 0;

      const embed = new EmbedBuilder()
        .setTitle('{emoji:briefcase} الحساب البنكي')
        .setDescription(
          `مرحباً <@${userId}>، إليك رصيدك المالي الحالي:\n\n{emoji:gift} **الرصيد الكلي:** \`${userBalance.toLocaleString()}\``
        )
        .setColor(0x8c52ff)
        .setTimestamp();

      return message.reply({ embeds: [embed] }).catch(() => null);
    } catch (err) {
      logger.error('[Command Error - محفظة.js]:', err);
      if (message && typeof message.reply === 'function') {
        await message.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.' }).catch(() => null);
      }
    }
  }
};
