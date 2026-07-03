const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('عرض معلومات عن عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو المراد فحصه')),

  async execute(interaction) {
    const user = await (interaction.options.getUser('user') || interaction.user).fetch();
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const badges = {
      ActiveDeveloper: '🖥️ مطور نشط',
      BugHunterLevel1: '🐛 صائد أخطاء',
      BugHunterLevel2: '🐛 صائد أخطاء محترف',
      CertifiedModerator: '<:shield:1519212202676977788> مشرف معتمد',
      HypeSquadOnlineHouse1: '🏠 هايب سكواد بريفري',
      HypeSquadOnlineHouse2: '🏠 هايب سكواد برليانس',
      HypeSquadOnlineHouse3: '🏠 هايب سكواد بالانس',
      Hypesquad: '<:trophy:1519212189171454003> هايب سكواد إيفينتس',
      Partner: '🤝 شريك ديسكورد',
      PremiumEarlySupporter: '💎 داعم مبكر',
      Staff: '<:settings:1519212212227407953> فريق ديسكورد',
      VerifiedDeveloper: '<:circlecheck:1519212246876557413> مطور بوت موثق',
    };

    const userBadges = user.flags?.toArray().map(f => badges[f] || f).join(', ') || 'لا يوجد';
    const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;
    const joinedAt = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'غير متاح';
    const roles = member ? member.roles.cache.filter(r => r.id !== interaction.guildId).map(r => `${r}`).slice(0, 15).join(', ') || 'لا يوجد' : 'غير متاح';
    const boostSince = member?.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:F>` : 'لا يبوست';
    const nickname = member?.nickname || 'لا يوجد';

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865F2)
      .setTitle(`<:user:1519212186633764995> ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '<:user:1519212186633764995> الاسم', value: user.tag, inline: true },
        { name: '<:briefcase:1519212162726363238> المعرّف', value: user.id, inline: true },
        { name: '<:clock:1519212244263632916> انضم لديسكورد', value: createdAt, inline: false },
        { name: '<:clock:1519212244263632916> في السيرفر منذ', value: joinedAt, inline: false },
        { name: '<:settings:1519212212227407953> بوت', value: user.bot ? 'نعم' : 'لا', inline: true },
        { name: '<:list:1519212232670580868> الكنية', value: nickname, inline: true },
        { name: '<:bolt:1519212174529134754> يبوست منذ', value: boostSince, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
