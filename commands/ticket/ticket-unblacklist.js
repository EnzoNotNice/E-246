const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-unblacklist')
    .setDescription('إزالة مستخدم من قائمة حظر التذاكر')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('المستخدم')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    if (!user) {
      return interaction.reply({
        content: '{emoji:circlex} يجب تحديد مستخدم',
        flags: ['Ephemeral']
      });
    }

    const isBlacklisted = db.isTicketBlacklisted(
      interaction.guild.id,
      user.id
    );

    if (!isBlacklisted) {
      return interaction.reply({
        content: '{emoji:circlex} هذا المستخدم غير موجود في قائمة الحظر',
        flags: ['Ephemeral']
      });
    }

    await db.removeTicketBlacklist(interaction.guild.id, user.id);

    return interaction.reply({
      content: `{emoji:circlecheck} تم إزالة ${user.tag} من قائمة حظر التذاكر`,
      flags: ['Ephemeral']
    });
  }
};
