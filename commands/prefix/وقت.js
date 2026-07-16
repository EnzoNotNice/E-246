const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  name: 'وقت',
  aliases: ['time', 'cooldowns'],
  async execute(message, args) {
    const guildSettings = db.getGuildSettings(message.guild.id);
    const bankChannelId = guildSettings ? guildSettings.bank_channel : null;
    if (bankChannelId && message.channel.id !== bankChannelId) {
      return message.reply({ content: `{emoji:circlex} لا يمكنك استخدام أوامر البنك خارج الروم المخصص: <#${bankChannelId}>` }).catch(() => null);
    }

    const userId = message.author.id;
    const now = Date.now();

    const cooldowns = [
      { name: 'الهدية اليومية', key: 'cooldown_daily_', limit: 172800000 },
      { name: 'الراتب اليومي', key: 'cooldown_salary_', limit: 86400000 },
      { name: 'الاستثمار', key: 'cooldown_invest_', limit: 14400000 },
      { name: 'التداول', key: 'cooldown_trade_', limit: 14400000 },
      { name: 'المقامرة', key: 'cooldown_gamble_', limit: 14400000 },
      { name: 'رمي النرد', key: 'cooldown_dice_', limit: 14400000 },
      { name: 'رمي العملة', key: 'cooldown_coin_', limit: 7200000 },
      { name: 'سرقة ونهب', key: 'cooldown_rob_', limit: 14400000 }
    ];

    const embed = new EmbedBuilder()
      .setTitle('{emoji:clock} مؤقتات المهل والانتظار للأوامر')
      .setDescription(`مرحباً <@${userId}>، إليك حالة فترات الانتظار الخاصة بك لحسابك البنكي:`)
      .setColor(0x8C52FF)
      .setTimestamp();

    for (const cd of cooldowns) {
      const lastUsed = await db.getKV(cd.key + userId);
      if (lastUsed && (now - lastUsed) < cd.limit) {
        const remaining = cd.limit - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        let timeStr = '';
        if (hours > 0) timeStr += `${hours} ساعة و `;
        if (minutes > 0 || hours > 0) timeStr += `${minutes} دقيقة و `;
        timeStr += `${seconds} ثانية`;

        embed.addFields({ name: cd.name, value: `{emoji:clock} **متبقي:** \`${timeStr}\``, inline: true });
      } else {
        embed.addFields({ name: cd.name, value: `{emoji:circlecheck} **جاهز للاستخدام**`, inline: true });
      }
    }

    const shieldTime = await db.getKV(`shield_${userId}`);
    if (shieldTime && now < shieldTime) {
      const remaining = shieldTime - now;
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      embed.addFields({ name: 'درع الحماية النشط', value: `{emoji:shield} **متبقي:** \`${hours} ساعة و ${minutes} دقيقة\``, inline: false });
    } else {
      embed.addFields({ name: 'درع الحماية النشط', value: `{emoji:circlex} **غير مفعل**`, inline: false });
    }

    return message.reply({ embeds: [embed] }).catch(() => null);
  }
};
