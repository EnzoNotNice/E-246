const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const logger = require('../../utils/logger');

const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('protection')
    .setDescription('إعداد الحماية التلقائية')
    .addSubcommand((s) =>
      s
        .setName('antilink')
        .setDescription('إعداد منع الروابط')
        .addBooleanOption((o) => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true))
        .addRoleOption((o) => o.setName('bypass').setDescription('الرتبة المستثناة'))
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('تحديد روم محدد (اتركه فارغاً للسيرفر كامل)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('antispam')
        .setDescription('إعداد منع السبام')
        .addBooleanOption((o) => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('antiraid')
        .setDescription('إعداد منع الرايد')
        .addBooleanOption((o) => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const enabled = interaction.options.getBoolean('enabled');
      const bypass = interaction.options.getRole('bypass');
      const channel = interaction.options.getChannel('channel');

      const icons = { antilink: '{emoji:settings}', antispam: '{emoji:shield}', antiraid: '{emoji:shieldlock}' };
      const names = { antilink: 'حماية الروابط', antispam: 'حماية السبام', antiraid: 'حماية الريد' };

      const protection = db.getProtection(interaction.guildId);

      if (sub === 'antilink' && channel) {
        const channels = protection.antilink_channels || [];
        if (enabled && !channels.includes(channel.id)) {
          channels.push(channel.id);
          protection.antilink_channels = channels;
        } else if (!enabled) {
          protection.antilink_channels = channels.filter((c) => c !== channel.id);
        }
        db.updateProtection(interaction.guildId, { antilink_channels: protection.antilink_channels });
      } else {
        const updateData = {
          [sub]: enabled ? 1 : 0
        };
        if (bypass) {
          updateData.bypass_role = bypass.id;
        }
        db.updateProtection(interaction.guildId, updateData);
      }

      const embed = new EmbedBuilder()
        .setColor(enabled ? '#57F287' : '#ED4245')
        .setTitle(`${icons[sub]} ${names[sub]}`)
        .setDescription(
          `**${enabled ? 'تم تفعيل' : 'تم تعطيل'}** ${names[sub]}${bypass ? `\n**الرتبة المُعفاة** <@&${bypass.id}>` : ''}${channel ? `\n**الروم** <#${channel.id}>` : ''}`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('[Command Error - protection.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
