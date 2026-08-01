const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { error, info } = require('../../utils/embeds');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('إرسال اقتراح جديد للتصويت')
    .addStringOption((o) => o.setName('content').setDescription('نص الاقتراح').setRequired(true)),

  async execute(interaction) {
    try {
      const content = interaction.options.getString('content');
      const settings = db.getSuggestionSettings(interaction.guildId);

      if (!settings || !settings.channelId || !settings.logChannelId) {
        return interaction.reply({
          embeds: [error('نظام الاقتراحات غير مفعل في هذا السيرفر حالياً')],
          flags: ['Ephemeral']
        });
      }

      const channel = interaction.guild.channels.cache.get(settings.channelId);
      const reviewChannel = interaction.guild.channels.cache.get(settings.logChannelId);

      if (!channel || !reviewChannel) {
        return interaction.reply({
          embeds: [error('فشل العثور على روم الاقتراحات أو روم المراجعة')],
          flags: ['Ephemeral']
        });
      }

      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      // 1. Send public suggestion post
      const publicEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('__اقتراح جديد__')
        .setDescription(content)
        .addFields(
          { name: '**بواسطة:**', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: '**الحالة:**', value: '{emoji:clock} قيد المراجعة والتصويت', inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL({}))
        .setTimestamp();

      const publicRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('suggest_vote_up').setLabel('موافق 👍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('suggest_vote_down').setLabel('معارض 👎').setStyle(ButtonStyle.Danger)
      );

      const publicMsg = await channel.send({ embeds: [publicEmbed], components: [publicRow] });

      // Save suggestion in database
      db.addSuggestion(interaction.guildId, publicMsg.id, interaction.user.id, interaction.user.tag, content);

      // Create thread if configured
      if (settings.autoThread) {
        await publicMsg
          .startThread({
            name: `مناقشة اقتراح ${interaction.user.username}`,
            autoArchiveDuration: 1440
          })
          .catch(() => null);
      }

      // 2. Send review post to staff channel
      const reviewEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('__طلب مراجعة اقتراح جديد__')
        .setDescription(content)
        .addFields(
          { name: '**بواسطة:**', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: '**رسالة الاقتراح:**', value: `[اضغط هنا للذهاب للرسالة](${publicMsg.url})`, inline: true }
        )
        .setFooter({ text: `ID: ${publicMsg.id}` })
        .setTimestamp();

      const reviewRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`suggest_accept_${publicMsg.id}`)
          .setLabel('قبول الاقتراح ✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`suggest_reject_${publicMsg.id}`)
          .setLabel('رفض الاقتراح ❌')
          .setStyle(ButtonStyle.Danger)
      );

      await reviewChannel.send({ embeds: [reviewEmbed], components: [reviewRow] });

      return interaction.editReply({
        embeds: [info('تم إرسال اقتراحك بنجاح وجارٍ عرضه للتصويت والمراجعة')]
      });
    } catch (err) {
      logger.error('[Command Error - suggest.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
