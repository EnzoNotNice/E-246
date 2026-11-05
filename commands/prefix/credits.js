const { AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { generateTransferCaptcha } = require('../../utils/captchaCanvas');
const logger = require('../../utils/logger');

const activeTransfers = new Set();

function isUserTransferring(userId) {
  return activeTransfers.has(userId);
}

function normalizeDigits(str) {
  if (!str) return '';
  return String(str)
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9')
    .trim();
}

function parseAmount(str, userBalance) {
  if (!str) return null;
  const lower = String(str).toLowerCase().trim();
  if (['all', 'كل', 'الكل'].includes(lower)) {
    return userBalance;
  }
  let multiplier = 1;
  let cleanStr = lower;
  if (cleanStr.endsWith('k')) {
    multiplier = 1000;
    cleanStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('m')) {
    multiplier = 1000000;
    cleanStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('b')) {
    multiplier = 1000000000;
    cleanStr = cleanStr.slice(0, -1);
  }
  const parsed = Math.floor(parseFloat(cleanStr) * multiplier);
  return isNaN(parsed) ? null : parsed;
}

module.exports = {
  name: 'credits',
  aliases: ['كريدت', 'credit', 'c', 'رصيد', 'فلوس'],
  isUserTransferring,
  async execute(message, args) {
    try {
      const client = message.client;
      const author = message.author;
      const guildId = message.guild.id;

      // Check if command is restricted by channel
      const guildSettings = db.getGuildSettings(guildId);
      const bankChannelId = guildSettings ? guildSettings.bank_channel : null;
      if (bankChannelId && message.channel.id !== bankChannelId) {
        return message
          .reply({
            content: `{emoji:circlex} لا يمكنك استخدام أوامر الكريدت والبنك خارج الروم المخصص: <#${bankChannelId}>`
          })
          .catch(() => null);
      }

      const authorBalance = (await db.getKV(`balance_${author.id}`)) || 0;

      // Case 1: #credits without args -> View author balance
      if (!args || args.length === 0) {
        return message.reply({
          content: `:bank: | **${author.username}**, your account balance is \`$${authorBalance.toLocaleString()}\`.`
        });
      }

      // Case 2: #credits with 1 arg
      if (args.length === 1) {
        const firstArg = args[0];
        const mentionMatch = firstArg.match(/^<@!?(\d+)>$/);
        const targetId = mentionMatch ? mentionMatch[1] : /^\d{17,20}$/.test(firstArg) ? firstArg : null;

        if (targetId) {
          const targetUser = await client.users.fetch(targetId).catch(() => null);
          if (targetUser) {
            const targetBalance = (await db.getKV(`balance_${targetUser.id}`)) || 0;
            return message.reply({
              content: `:bank: | **${targetUser.username}**, account balance is \`$${targetBalance.toLocaleString()}\`.`
            });
          }
        }

        // Maybe author typed `#credits 100` without specifying target
        const parsedAsAmount = parseAmount(firstArg, authorBalance);
        if (parsedAsAmount !== null && parsedAsAmount > 0) {
          return message.reply({
            content: `:x: | يرجى تحديد العضو المراد تحويل الكريدت إليه. مثال: \`#credits @user ${firstArg}\``
          });
        }

        return message.reply({
          content: `:bank: | **${author.username}**, your account balance is \`$${authorBalance.toLocaleString()}\`.`
        });
      }

      // Case 3: Transfer flow: `#credits @user <amount>` OR `#credits <amount> @user`
      let targetUser = null;
      let rawAmount = null;

      // Check mentions first
      if (message.mentions.users.size > 0) {
        targetUser = message.mentions.users.first();
        rawAmount = args.find((a) => !a.includes(targetUser.id));
      } else {
        // Check raw user IDs
        if (/^\d{17,20}$/.test(args[0])) {
          targetUser = await client.users.fetch(args[0]).catch(() => null);
          rawAmount = args[1];
        } else if (/^\d{17,20}$/.test(args[1])) {
          targetUser = await client.users.fetch(args[1]).catch(() => null);
          rawAmount = args[0];
        }
      }

      if (!targetUser) {
        return message.reply({
          content: ':x: | لم يتم العثور على العضو المحدد. يرجى منشن العضو أو كتابة الآيدي الخاص به.'
        });
      }

      const amount = parseAmount(rawAmount, authorBalance);

      if (targetUser.id === author.id) {
        return message.reply({ content: ':x: | لا يمكنك تحويل الأموال إلى حسابك الشخصي.' });
      }

      if (targetUser.bot) {
        return message.reply({ content: ':x: | لا يمكنك تحويل الأموال إلى حسابات البوتات.' });
      }

      if (!amount || amount < 1) {
        return message.reply({ content: ':x: | يرجى تحديد مبلغ صالح للتحويل (1 على الأقل).' });
      }

      if (authorBalance < amount) {
        return message.reply({
          content: `:x: | رصيدك الحالي غير كافٍ لإتمام التحويل. رصيدك الحالي: \`$${authorBalance.toLocaleString()}\``
        });
      }

      const outstandingLoan = await db.getKV(`loan_${author.id}`);
      if (outstandingLoan && outstandingLoan > 0) {
        return message.reply({
          content: ':x: | لا يمكنك تحويل الأموال حتى تقوم بتسديد القرض المالي النشط عليك.'
        });
      }

      // Prevent concurrent transfers from the same user (anti-race condition)
      if (activeTransfers.has(author.id)) {
        return message.reply({
          content: ':warning: | لديك عملية تحويل قيد الانتظار بالفعل! يرجى إكمال رمز التحقق أو الانتظار حتى تنتهي.'
        });
      }

      activeTransfers.add(author.id);

      try {
        // ProBot 5% Tax Calculation - 0% Tax Perk for Server Boosters
        const isBooster = Boolean(message.member?.premiumSince);
        const taxRate = isBooster ? 0 : 0.05;
        const tax = Math.floor(amount * taxRate);
        const netAmount = amount - tax;

        // Generate distorted Canvas Captcha card on the fly
        const { code, buffer } = await generateTransferCaptcha();
        const captchaAttachment = new AttachmentBuilder(buffer, { name: 'captcha.png' });

        const taxNotice = isBooster ? ' (معفي من الضريبة - ميزة البوستر 🚀)' : '';
        await message.reply({
          content: `⚠️ | **${author.username}**, ضريبة التحويل: \`$${tax.toLocaleString()}\`${taxNotice}، المبلغ الصافي: \`$${netAmount.toLocaleString()}\`\nاكتب الأرقام التالية للتأكيد:`,
          files: [captchaAttachment]
        });

        // Await user response within 20 seconds
        const filter = (m) => m.author.id === author.id;
        let collected;
        try {
          collected = await message.channel.awaitMessages({
            filter,
            max: 1,
            time: 20000,
            errors: ['time']
          });
        } catch {
          return message.reply({ content: '⏰ | انتهى الوقت (20 ثانية)، تم إلغاء عملية التحويل.' }).catch(() => null);
        }

        const rawResponse = collected.first()?.content?.trim();
        const userResponse = normalizeDigits(rawResponse);

        if (['cancel', 'الغاء', 'إلغاء', 'c'].includes(rawResponse?.toLowerCase())) {
          return message.reply({ content: '❌ | تم إلغاء عملية التحويل بناءً على طلبك.' });
        }

        if (userResponse !== code) {
          return message.reply({ content: '❌ | تم إلغاء العملية بسبب كتابة رمز غير صحيح.' });
        }

        // Fetch fresh balances right before executing transfer to prevent race conditions
        const freshAuthorBal = (await db.getKV(`balance_${author.id}`)) || 0;
        if (freshAuthorBal < amount) {
          return message.reply({ content: ':x: | حدث خطأ، رصيدك تغير ولم يعد كافياً لإتمام العملية.' });
        }

        const freshTargetBal = (await db.getKV(`balance_${targetUser.id}`)) || 0;

        await db.setKV(`balance_${author.id}`, freshAuthorBal - amount);
        await db.setKV(`balance_${targetUser.id}`, freshTargetBal + netAmount);

        // Daily Quest: credit transfer progress
        db.incrementQuestProgress(author.id, 'transfer', 1);

        await message.reply({
          content: `:moneybag: | **${author.username}**, تم تحويل \`$${netAmount.toLocaleString()}\` إلى **${targetUser.username}** بنجاح!`
        });

        // Send polite DM notification to recipient
        targetUser
          .send({
            content: `:envelope_with_arrow: | تم استلام \`$${netAmount.toLocaleString()}\` كريدت في حسابك من **${author.username}** (ضريبة: \`$${tax.toLocaleString()}\`).`
          })
          .catch(() => null);
      } finally {
        activeTransfers.delete(author.id);
      }
    } catch (err) {
      logger.error('[Command Error - credits.js]:', err);
      message.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.' }).catch(() => null);
    }
  }
};
