const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  name: 'title',
  aliases: ['لقب', 'بايو', 'bio'],
  async execute(message, args) {
    try {
      const author = message.author;
      if (!args || args.length === 0) {
        const currentTitle = (await db.getKV(`bio_${author.id}`)) || 'عضو مميز في السيرفر';
        return message.reply({
          content: `:scroll: | **${author.username}**, اللقب الحالي لبروفايلك:\n> \`${currentTitle}\`\nلتغيير اللقب اكتب: \`#title <النص الجديد>\``
        });
      }

      const newTitle = args.join(' ').trim().slice(0, 80);
      await db.setKV(`bio_${author.id}`, newTitle);

      return message.reply({
        content: `:white_check_mark: | **${author.username}**, تم تحديث لقب بروفايلك بنجاح:\n> \`${newTitle}\``
      });
    } catch (err) {
      logger.error('[Command Error - title.js]:', err);
      message.reply({ content: '❌ حدث خطأ أثناء تغيير اللقب.' }).catch(() => null);
    }
  }
};
