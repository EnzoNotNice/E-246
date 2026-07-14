const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('إعدادات نظام المستويات')
    .addSubcommand(s => s.setName('show').setDescription('عرض إعدادات المستويات'))
    .addSubcommand(s => s.setName('toggle').setDescription('تبديل نظام المستويات'))
    .addSubcommand(s => s.setName('channel').setDescription('روم إعلانات الترقية')
      .addChannelOption(o => o.setName('channel').setDescription('روم إعلانات الترقية').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(s => s.setName('xp').setDescription('نطاق نقاط الخبرة')
      .addIntegerOption(o => o.setName('min').setDescription('الحد الأدنى للخبرة').setRequired(true).setMinValue(1).setMaxValue(1000))
      .addIntegerOption(o => o.setName('max').setDescription('الحد الأقصى للخبرة').setRequired(true).setMinValue(1).setMaxValue(1000)))
    .addSubcommand(s => s.setName('cooldown').setDescription('تحديد وقت التهدئة')
      .addIntegerOption(o => o.setName('seconds').setDescription('ثواني التهدئة').setRequired(true).setMinValue(0).setMaxValue(3600)))
    .addSubcommand(s => s.setName('reward').setDescription('إضافة رتبة مكافأة')
      .addIntegerOption(o => o.setName('level').setDescription('المستوى').setRequired(true).setMinValue(1))
      .addRoleOption(o => o.setName('role').setDescription('الرتبة المكافأة').setRequired(true)))
    .addSubcommand(s => s.setName('removereward').setDescription('إزالة رتبة مكافأة')
      .addIntegerOption(o => o.setName('level').setDescription('مستوى حذف المكافأة').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const settings = db.getLevelSettings(interaction.guildId);

    if (sub === 'show') {
      const rawRewards = settings.role_rewards;
      const rewards = Array.isArray(rawRewards) ? rawRewards : JSON.parse(rawRewards || '[]');
      const rewardStr = rewards.length ? rewards.map(r => `المستوى **${r.level}** → <@&${r.roleId}>`).join('\n') : 'لا يوجد';
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('{emoji:settings} إعدادات نظام المستويات')
        .addFields(
          { name: '{emoji:chartpie} الحالة', value: settings.enabled ? '{emoji:circlecheck} مفعّل' : '{emoji:circlex} معطّل', inline: true },
          { name: '{emoji:mail} الروم', value: settings.channel ? `<#${settings.channel}>` : 'غير محدد', inline: true },
          { name: '{emoji:star} نطاق XP', value: `${settings.xp_min} – ${settings.xp_max}`, inline: true },
          { name: '{emoji:clock} وقت التهدئة', value: `${settings.xp_cooldown} ثانية`, inline: true },
          { name: '{emoji:user} مكافآت الرتب', value: rewardStr }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'toggle') {
      const newVal = settings.enabled ? 0 : 1;
      db.db.prepare('UPDATE level_settings SET enabled = ? WHERE guildId = ?').run(newVal, interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('levels.systemStatus', { status: newVal ? 'مفعل' : 'معطل' }))] });
    }

    if (sub === 'channel') {
      const ch = interaction.options.getChannel('channel');
      db.db.prepare('UPDATE level_settings SET channel = ? WHERE guildId = ?').run(ch ? ch.id : null, interaction.guildId);
      return interaction.reply({ embeds: [success(ch ? locale.get('levels.channelSet', { channel: ch }) : locale.get('levels.channelDefault'))] });
    }

    if (sub === 'xp') {
      const min = interaction.options.getInteger('min');
      const max = interaction.options.getInteger('max');
      if (min > max) return interaction.reply({ embeds: [error(locale.get('general.invalidValue'))], flags: ['Ephemeral'] });
      db.db.prepare('UPDATE level_settings SET xp_min = ?, xp_max = ? WHERE guildId = ?').run(min, max, interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('levels.xpRangeSet', { min, max }))] });
    }

    if (sub === 'cooldown') {
      const secs = interaction.options.getInteger('seconds');
      db.db.prepare('UPDATE level_settings SET xp_cooldown = ? WHERE guildId = ?').run(secs, interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('levels.cooldownSet', { secs }))] });
    }

    if (sub === 'reward') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      const rawRewards = settings.role_rewards;
      const rewards = (Array.isArray(rawRewards) ? rawRewards : JSON.parse(rawRewards || '[]')).filter(r => r.level !== level);
      rewards.push({ level, roleId: role.id });
      rewards.sort((a, b) => a.level - b.level);
      db.db.prepare('UPDATE level_settings SET role_rewards = ? WHERE guildId = ?').run(JSON.stringify(rewards), interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('levels.rewardAdded', { level, role }))] });
    }

    if (sub === 'removereward') {
      const level = interaction.options.getInteger('level');
      const rawRewards = settings.role_rewards;
      const rewards = (Array.isArray(rawRewards) ? rawRewards : JSON.parse(rawRewards || '[]')).filter(r => r.level !== level);
      db.db.prepare('UPDATE level_settings SET role_rewards = ? WHERE guildId = ?').run(JSON.stringify(rewards), interaction.guildId);
      return interaction.reply({ embeds: [success(locale.get('levels.rewardRemoved', { level }))] });
    }
  }
};
