const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('معلومات عن السيرفر'),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.fetch();

    const verificationLevels = { 0: 'لا يوجد', 1: 'منخفض', 2: 'متوسط', 3: 'عالي', 4: 'عالي جداً' };
    const boostTiers = { 0: 'لا يوجد', 1: 'مستوى 1', 2: 'مستوى 2', 3: 'مستوى 3' };

    const members = guild.memberCount;
    const roles = guild.roles.cache.size - 1;
    const channels = guild.channels.cache.size;
    const emojis = guild.emojis.cache.size;
    const stickers = guild.stickers.cache.size;
    const boosts = guild.premiumSubscriptionCount;
    const boostTier = boostTiers[guild.premiumTier] || 'لا يوجد';
    const owner = await guild.fetchOwner();
    const created = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`{emoji:chartpie} ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: '{emoji:crown} المالك', value: `${owner.user.tag}`, inline: true },
        { name: '{emoji:infocircle} معرّف السيرفر', value: guild.id, inline: true },
        { name: '{emoji:clock} تاريخ الإنشاء', value: created, inline: false },
        { name: '{emoji:user} الأعضاء', value: `\`${members.toLocaleString()}\``, inline: true },
        { name: '{emoji:message} الروومات', value: `\`${channels}\``, inline: true },
        { name: '{emoji:user} الرتب', value: `\`${roles}\``, inline: true },
        { name: '{emoji:moodsmile} الإيموجيات', value: `\`${emojis}\``, inline: true },
        { name: '{emoji:photo} الستيكرز', value: `\`${stickers}\``, inline: true },
        { name: '{emoji:bolt} البوستات', value: `\`${boosts}\` (${boostTier})`, inline: true },
        { name: '{emoji:shield} مستوى التحقق', value: verificationLevels[guild.verificationLevel], inline: true },
      )
      .setImage(guild.bannerURL({ size: 1024 }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
