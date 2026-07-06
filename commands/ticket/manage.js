const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('إدارة التذكرة الحالية')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('إضافة عضو للتذكرة')
        .addUserOption(o => o.setName('member').setDescription('العضو المراد إضافته').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('إزالة عضو من التذكرة')
        .addUserOption(o => o.setName('member').setDescription('العضو المراد إزالته').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('rename')
        .setDescription('تغيير اسم التذكرة')
        .addStringOption(o => o.setName('name').setDescription('الاسم الجديد للتذكرة').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const ticket = db.getTicketByChannel(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ embeds: [error('يجب تشغيل هذا الأمر داخل تذكرة نشطة')], flags: ['Ephemeral'] });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const member = interaction.options.getMember('member');
      if (!member) {
        return interaction.reply({ embeds: [error('العضو غير موجود في السيرفر')], flags: ['Ephemeral'] });
      }

      await interaction.channel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      return interaction.reply({ embeds: [success(`تمت إضافة <@${member.id}> إلى التذكرة بنجاح`)] });
    }

    if (sub === 'remove') {
      const member = interaction.options.getMember('member');
      if (!member) {
        return interaction.reply({ embeds: [error('العضو غير موجود في السيرفر')], flags: ['Ephemeral'] });
      }

      await interaction.channel.permissionOverwrites.edit(member.id, {
        ViewChannel: false,
        SendMessages: false
      });

      return interaction.reply({ embeds: [success(`تمت إزالة <@${member.id}> من التذكرة بنجاح`)] });
    }

    if (sub === 'rename') {
      const name = interaction.options.getString('name');
      await interaction.channel.setName(name);
      return interaction.reply({ embeds: [success(`تم تغيير اسم التذكرة إلى \`${name}\` بنجاح`)] });
    }
  }
};
