const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boost-setup')
    .setDescription('إعداد رسالة شكر البوست')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('تحديد رسالة شكر البوست')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('روم إرسال رسالة الشكر')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((o) =>
          o.setName('message').setDescription('رسالة الشكر (استخدم {user} لمنشن العضو)').setRequired(true)
        )
        .addBooleanOption((o) => o.setName('embed').setDescription('إرسال كإيمبد'))
    )
    .addSubcommand((sub) => sub.setName('disable').setDescription('تعطيل رسالة شكر البوست'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        const useEmbed = interaction.options.getBoolean('embed') || false;

        db.setBoostSettings(guildId, channel.id, message, useEmbed);

        return interaction.reply({
          embeds: [
            success(
              `تم إعداد رسالة شكر البوست بنجاح\n\n**الروم** <#${channel.id}>\n**الرسالة** ${message}\n**الإيمبد** ${useEmbed ? 'مفعّل' : 'معطل'}`
            )
          ]
        });
      }

      if (sub === 'disable') {
        db.setBoostSettings(guildId, null, null, false);
        return interaction.reply({
          embeds: [success('تم تعطيل رسالة شكر البوست بنجاح')]
        });
      }
    } catch (err) {
      logger.error('[Command Error - boost-setup.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction
          .reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] })
          .catch(() => null);
      }
    }
  }
};
