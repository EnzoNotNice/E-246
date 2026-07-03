const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('عرض معلومات عن السيرفر'),

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
      .setTitle(`<:chartpie:1519212248479043634> ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: '<:crown:1519212241310715916> المالك', value: `${owner.user.tag}`, inline: true },
        { name: '<:infocircle:1519212235258335324> معرّف السيرفر', value: guild.id, inline: true },
        { name: '<:clock:1519212244263632916> تاريخ الإنشاء', value: created, inline: false },
        { name: '<:user:1519212186633764995> الأعضاء', value: `\`${members.toLocaleString()}\``, inline: true },
        { name: '<:message:1519212228132208701> الروومات', value: `\`${channels}\``, inline: true },
        { name: '<:user:1519212186633764995> الرتب', value: `\`${roles}\``, inline: true },
        { name: '<:moodsmile:1519212226723188907> الإيموجيات', value: `\`${emojis}\``, inline: true },
        { name: '&#127912; الستيكرز', value: `\`${stickers}\``, inline: true },
        { name: '<:bolt:1519212174529134754> البوستات', value: `\`${boosts}\` (${boostTier})`, inline: true },
        { name: '<:shield:1519212202676977788> مستوى التحقق', value: verificationLevels[guild.verificationLevel], inline: true },
      )
      .setImage(guild.bannerURL({ size: 1024 }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
