const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  name: 'rep',
  aliases: ['سمعة', 'سمعه', 'point'],
  async execute(message, args) {
    try {
      const author = message.author;
      const client = message.client;

      if (!args || args.length === 0) {
        const userRep = (await db.getKV(`rep_${author.id}`)) || 0;
        return message.reply({
          content: `:star: | **${author.username}**, إجمالي نقاط السمعة لديك: \`+${userRep}\` نقاط.`
        });
      }

      const firstArg = args[0];
      const match = firstArg.match(/^<@!?(\d+)>$/) || [null, firstArg];
      const targetId = match[1];

      let targetUser = null;
      if (targetId && /^\d{17,20}$/.test(targetId)) {
        targetUser = await client.users.fetch(targetId).catch(() => null);
      }

      if (!targetUser) {
        return message.reply({
          content: ':x: | يرجى منشن العضو أو كتابة الآيدي الخاص به لمنحه نقطة سمعة.'
        });
      }

      if (targetUser.id === author.id) {
        return message.reply({
          content: ':x: | لا يمكنك إعطاء نقطة سمعة لنفسك!'
        });
      }

      if (targetUser.bot) {
        return message.reply({
          content: ':x: | لا يمكنك إعطاء نقاط سمعة للبوتات.'
        });
      }

      const now = Date.now();
      const lastRep = await db.getKV(`rep_last_${author.id}`);
      const cooldown = 24 * 60 * 60 * 1000;

      if (lastRep && now - lastRep < cooldown) {
        const remaining = cooldown - (now - lastRep);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply({
          content: `:clock: | **${author.username}**, يمكنك إعطاء نقطة سمعة بعد **${hours} ساعة و ${minutes} دقيقة**.`
        });
      }

      let currentRep = (await db.getKV(`rep_${targetUser.id}`)) || 0;
      currentRep += 1;

      await db.setKV(`rep_${targetUser.id}`, currentRep);
      await db.setKV(`rep_last_${author.id}`, now);

      return message.reply({
        content: `:white_check_mark: | **${author.username}**, لقد منحت نقطة سمعة إلى **${targetUser.username}** بنجاح! (+rep: \`${currentRep}\`)`
      });
    } catch (err) {
      logger.error('[Command Error - rep.js]:', err);
      message.reply({ content: '❌ حدث خطأ أثناء تنفيذ أمر السمعة.' }).catch(() => null);
    }
  }
};
