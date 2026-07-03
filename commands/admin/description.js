const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const locale = require('../../utils/locale');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('وصف')
    .setDescription('عرض وصف البوت وخصائصه الرئيسية'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 وصف البوت')
      .setDescription(
        'هذا البوت متعدد الأغراض لإدارة السيرفرات المكتوب بالكامل باللغة العربية بالكامل.\n\n'
        + '**المميزات الرئيسية:**\n'
        + '• إدارة السيرفر: حظر، كيك، تحذير\n'
        + '• نظام المستويات وتحديد الأدوار\n'
        + '• نظام التذاكر مع إنشاء المحاضر\n'
        + '• نظام الحماية المضادة للريد\n'
        + '• نظام الترحيب مع الصور\n'
        + '• نظام الردود التلقائية\n'
        + '• نظام الدعاوات\n'
        + '• نظام الكابcha للتحقق\n'
        + '• نظام نماذج الطلب\n'
        + '• نظام المناصب التفاعلية\n'
        + '• نظام بناء الإيمبدات\n'
        + '• لوحة تحكم ويب كاملة\n\n'
        + '✨ مكتوب بالكامل باللغة العربية ويعمل مع Discord.js v14\n'
        + '🖼️ يدعم الصور والملفات عبر Canva\n'
        + '📊 قواعد بيانات SQLite مع 22 جدولاً\n\n'
        + 'انضم إلى أكثر من سيرفر واستخدم الأوامر لرؤية كل شيء يعمل!'
      )
      .setFooter({ text: 'مدعوم بالكامل باللغة العربية' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
