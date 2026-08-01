const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('إدارة الرسائل المثبتة في الروم')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('تعيين رسالة مثبتة في الروم الحالي')
        .addStringOption((o) => o.setName('content').setDescription('محتوى الرسالة').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('remove').setDescription('إزالة الرسالة المثبتة من الروم الحالي'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      if (subcommand === 'set') {
        const content = interaction.options.getString('content');
        db.setStickyMessage(interaction.guildId, interaction.channelId, content);

        // Delete old sticky if it existed in the channel
        const oldSticky = db.getStickyMessage(interaction.channelId);
        if (oldSticky && oldSticky.lastMessageId) {
          const oldMsg = await interaction.channel.messages.fetch(oldSticky.lastMessageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => null);
        }

        // Send a fresh sticky message
        const stickyMsg = await interaction.channel.send({
          content: `__**رسالة مثبتة**__\n\n${content}`
        });
        db.updateStickyMessageId(interaction.channelId, stickyMsg.id);

        return interaction.editReply({
          embeds: [success('تم تثبيت الرسالة بنجاح في هذا الروم')]
        });
      }

      if (subcommand === 'remove') {
        const sticky = db.getStickyMessage(interaction.channelId);
        if (!sticky) {
          return interaction.editReply({
            embeds: [error('لا توجد رسالة مثبتة في هذا الروم')]
          });
        }

        if (sticky.lastMessageId) {
          const oldMsg = await interaction.channel.messages.fetch(sticky.lastMessageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => null);
        }

        db.removeStickyMessage(interaction.channelId);

        return interaction.editReply({
          embeds: [success('تمت إزالة الرسالة المثبتة بنجاح')]
        });
      }
    } catch (err) {
      logger.error('[Command Error - sticky.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
