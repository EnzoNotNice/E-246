const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const locale = require('../../utils/locale');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('عرض جميع أوامر البوت'),

  async execute(interaction) {
    const emojis = {
      admin: '1519212241310715916',
      public: '1519212235258335324',
      giveaway: '1519212243026448394',
      ticket: '1519212195945119814',
      protection: '1519212231332593785',
      levels: '1519212248479043634',
      automation: '1519212254720167996',
      invite: '1519212239876395138',
      greet: '1519212238160924692',
      economy: '1519212237317865553',
      games: '1519212218867253258',
      utils: '1519212254720167996'
    };

    const arNames = {
      admin: 'الإدارة',
      public: 'العامة',
      giveaway: 'الجيف أواي',
      ticket: 'التذاكر',
      protection: 'الحماية',
      levels: 'المستويات',
      automation: 'الردود التلقائية والخطوط',
      invite: 'الدعوات',
      greet: 'الترحيب',
      economy: 'الاقتصاد',
      games: 'الألعاب والتسلية',
      utils: 'الأدوات'
    };

    const commandDirs = fs.readdirSync(path.join(__dirname, '..')).filter(d => d !== 'prefix' && fs.statSync(path.join(__dirname, '..', d)).isDirectory());

    const options = commandDirs.map(dir => {
      return {
        label: `أوامر ${arNames[dir] || dir}`,
        description: `عرض جميع أوامر قسم ${arNames[dir] || dir}`,
        value: `help_${dir}`,
        emoji: emojis[dir] || '1519212238160924692'
      };
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('اختر قسماً لعرض أوامره...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle('<:layoutdashboard:1519212233849180190> قائمة المساعدة')
      .setDescription('**أهلاً بك في قائمة المساعدة**\n\nيرجى استخدام القائمة المنسدلة بالأسفل لاختيار القسم الذي تود عرض أوامره جميع الأوامر مرتبة ومقسمة لتسهيل الوصول إليها')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
