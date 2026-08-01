const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('عرض أوامر البوت'),

  async execute(interaction) {
    let emojisJson = {};
    try {
      emojisJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../utils/emojis.json'), 'utf8'));
    } catch (e) {
      logger.error('[help] Failed to parse emojis.json, falling back to empty:', e);
    }

    function parseEmoji(emojiKey, fallbackId) {
      const emojiStr = emojisJson[emojiKey];
      if (!emojiStr) return { name: '📁', id: fallbackId };
      const customMatch = emojiStr.match(/<a?:(\w+):(\d+)>/);
      if (customMatch) {
        return { name: customMatch[1], id: customMatch[2] };
      }
      return { name: emojiStr };
    }

    const emojis = {
      admin: parseEmoji('crown', '1525592197913645118'),
      public: parseEmoji('infocircle', '1525592250497761421'),
      giveaway: parseEmoji('confetti', '1525592192255525044'),
      ticket: parseEmoji('ticket', '1525592573039743097'),
      protection: parseEmoji('shield', '1525592537669046282'),
      levels: parseEmoji('chartpie', '1525592168058716273'),
      automation: parseEmoji('settings', '1525592531398823988'),
      invite: parseEmoji('mail', '1525592273121841322'),
      greet: parseEmoji('folder', '1525592214846181487'),
      economy: parseEmoji('gift', '1525592226690765001'),
      games: parseEmoji('playerplay', '1525592513254002841'),
      utils: parseEmoji('adjustments', '1525592066627993792'),
      music: parseEmoji('music_play', '1525592315060687060')
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
      utils: 'الأدوات',
      music: 'الموسيقى'
    };

    const commandDirs = fs
      .readdirSync(path.join(__dirname, '..'))
      .filter((d) => d !== 'prefix' && fs.statSync(path.join(__dirname, '..', d)).isDirectory());

    const options = commandDirs.map((dir) => {
      const emoji = emojis[dir] || { id: '1525592214846181487' };
      return {
        label: `أوامر ${arNames[dir] || dir}`,
        description: `عرض جميع أوامر قسم ${arNames[dir] || dir}`,
        value: `help_${dir}`,
        emoji: emoji
      };
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('اختر قسماً لعرض أوامره...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    function resolveEmoji(key, fallback) {
      const val = emojisJson[key];
      if (!val) return fallback;
      const m = val.match(/<a?:(\w+):(\d+)>/);
      if (m) return `<${m[0].startsWith('<a:') ? 'a:' : ':'}${m[1]}:${m[2]}>`;
      return val;
    }

    const dashboardEmoji = resolveEmoji('layoutdashboard', '📋');
    const crownEmoji = resolveEmoji('crown', '👑');
    const shieldEmoji = resolveEmoji('shield', '🛡️');
    const ticketEmoji = resolveEmoji('ticket', '🎫');
    const chartEmoji = resolveEmoji('chartpie', '📊');
    const musicEmoji = resolveEmoji('music_play', '🎵');
    const confettiEmoji = resolveEmoji('confetti', '🎉');
    const mailEmoji = resolveEmoji('mail', '✉️');
    const settingsEmoji = resolveEmoji('settings', '⚙️');
    const folderEmoji = resolveEmoji('folder', '📁');
    const gameEmoji = resolveEmoji('playerplay', '🎮');
    const utilsEmoji = resolveEmoji('adjustments', '🛠️');

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`${dashboardEmoji} __قائمة مساعدة البوت__`)
      .setDescription(
        `مرحباً بك في قائمة مساعدة **${interaction.client.user.username}**\n\n` +
          `اختر القسم الذي ترغب باستعراض أوامره من القائمة المنسدلة أسفله\n\n` +
          `__الأقسام المتاحة في البوت__\n` +
          `${crownEmoji} **الإدارة** • ${shieldEmoji} **الحماية** • ${ticketEmoji} **التذاكر** • ${chartEmoji} **المستويات**\n` +
          `${musicEmoji} **الموسيقى** • ${confettiEmoji} **الجيف أواي** • ${mailEmoji} **الدعوات** • ${settingsEmoji} **الآليات**\n` +
          `${folderEmoji} **الترحيب** • ${gameEmoji} **الألعاب والتسلية** • ${utilsEmoji} **الأدوات العامة**`
      )
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `طلب بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row] }).catch(() => null);
  }
};
