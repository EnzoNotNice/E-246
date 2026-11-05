const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('credits')
    .setDescription('عرض رصيد الكريدت')
    .addUserOption((o) => o.setName('user').setDescription('العضو المراد عرض رصيده')),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const balance = (await db.getKV(`balance_${targetUser.id}`)) || 0;

      if (targetUser.id === interaction.user.id) {
        return interaction.reply({
          content: `:bank: | **${interaction.user.username}**, your account balance is \`$${balance.toLocaleString()}\`.`
        });
      } else {
        return interaction.reply({
          content: `:bank: | **${targetUser.username}**, account balance is \`$${balance.toLocaleString()}\`.`
        });
      }
    } catch (err) {
      logger.error('[Slash Command Error - credits.js]:', err);
      const replyPayload = { content: '❌ حدث خطأ أثناء عرض الرصيد.', flags: ['Ephemeral'] };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyPayload).catch(() => null);
      } else {
        await interaction.reply(replyPayload).catch(() => null);
      }
    }
  }
};
