const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('معلومات عن عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو للفحص')),

  async execute(interaction) {
    try {  
      const user = await (interaction.options.getUser('user') || interaction.user).fetch();
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  
      const badges = {
        ActiveDeveloper: '🖥️ مطور نشط',
        BugHunterLevel1: '🐛 صائد أخطاء',
        BugHunterLevel2: '🐛 صائد أخطاء محترف',
        CertifiedModerator: '{emoji:shield} مشرف معتمد',
        HypeSquadOnlineHouse1: '🏠 هايب سكواد بريفري',
        HypeSquadOnlineHouse2: '🏠 هايب سكواد برليانس',
        HypeSquadOnlineHouse3: '🏠 هايب سكواد بالانس',
        Hypesquad: '{emoji:trophy} هايب سكواد إيفينتس',
        Partner: '🤝 شريك ديسكورد',
        PremiumEarlySupporter: '💎 داعم مبكر',
        Staff: '{emoji:settings} فريق ديسكورد',
        VerifiedDeveloper: '{emoji:circlecheck} مطور بوت موثق',
      };
  
      const userBadges = user.flags?.toArray().map(f => badges[f] || f).join(', ') || 'لا يوجد';
      const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;
      const joinedAt = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'غير متاح';
      const roles = member ? member.roles.cache.filter(r => r.id !== interaction.guildId).map(r => `${r}`).slice(0, 15).join(', ') || 'لا يوجد' : 'غير متاح';
      const boostSince = member?.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:F>` : 'لا يبوست';
      const nickname = member?.nickname || 'لا يوجد';
  
      const embed = new EmbedBuilder()
        .setColor(member?.displayColor || 0x5865F2)
        .setTitle(`{emoji:user} ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '{emoji:user} الاسم', value: user.tag, inline: true },
          { name: '{emoji:briefcase} المعرّف', value: user.id, inline: true },
          { name: '{emoji:clock} انضم لديسكورد', value: createdAt, inline: false },
          { name: '{emoji:clock} في السيرفر منذ', value: joinedAt, inline: false },
          { name: '{emoji:settings} بوت', value: user.bot ? 'نعم' : 'لا', inline: true },
          { name: '{emoji:list} الكنية', value: nickname, inline: true },
          { name: '{emoji:bolt} يبوست منذ', value: boostSince, inline: true }
        )
        .setTimestamp();
  
      return interaction.reply({ embeds: [embed] });
    
    } catch (err) {
      console.error('[Command Error - user.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
