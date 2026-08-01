const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactrole')
    .setDescription('إعداد رتبة تفاعلية')
    .addStringOption((option) => option.setName('message_id').setDescription('ايدي الرسالة').setRequired(true))
    .addStringOption((option) => option.setName('emoji').setDescription('الإيموجي').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('الرتبة المعطاة').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const emoji = interaction.options.getString('emoji');
    const role = interaction.options.getRole('role');

    try {
      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!message)
        return interaction.reply({
          content: '❌ لم يتم العثور على هذه الرسالة. تأكد من أن الـ ID صحيح وأن الرسالة في نفس الروم.',
          flags: ['Ephemeral']
        });

      await message.react(emoji).catch(() => null);

      let emojiKey = emoji;
      if (emoji.startsWith('<:') || emoji.startsWith('<a:')) {
        const parts = emoji.split(':');
        emojiKey = parts[parts.length - 1].replace('>', '');
      }

      db.addReactRole(messageId, interaction.guild.id, emojiKey, role.id);

      await interaction.reply({
        content: `✅ تم إعداد الرتبة بنجاح! الإيموجي: ${emoji} | الرتبة: <@&${role.id}>`,
        flags: ['Ephemeral']
      });
    } catch (error) {
      logger.error(error);
      await interaction.reply({
        content: '❌ حدث خطأ، تأكد من أن البوت لديه صلاحيات إضافة ريأكشن وأنه يمكنه إعطاء هذه الرتبة.',
        flags: 64
      });
    }
  }
};
