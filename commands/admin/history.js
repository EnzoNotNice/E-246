const logger = require('../../utils/logger');
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const { success, error, info } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('عرض سجل عقوبات عضو أو مسحه')
    .addUserOption((o) => o.setName('user').setDescription('العضو المراد عرض سجله').setRequired(true))
    .addBooleanOption((o) => o.setName('clear').setDescription('تحديد نعم لمسح السجل بالكامل').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser('user');
      const clear = interaction.options.getBoolean('clear');

      if (!target) {
        return interaction.reply({ embeds: [error('لم يتم العثور على العضو')], flags: ['Ephemeral'] });
      }

      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      if (clear) {
        if (interaction.user.id !== interaction.guild.ownerId && target.id === interaction.guild.ownerId) {
          return interaction.editReply({ embeds: [error('لا يمكنك مسح سجل الأونر')] });
        }
        db.clearModHistory(interaction.guildId, target.id);
        db.clearWarnings(target.id, interaction.guildId);
        return interaction.editReply({ embeds: [success(`تم مسح سجل العقوبات الخاص بـ **${target.tag}** بنجاح`)] });
      }

      const history = db.getModHistory(interaction.guildId, target.id) || [];
      const legacyWarnings = db.getWarnings(target.id, interaction.guildId) || [];

      const combined = [...history];
      if (combined.length === 0 && legacyWarnings.length > 0) {
        legacyWarnings.forEach((w) => {
          combined.push({
            guildId: interaction.guildId,
            targetId: target.id,
            targetTag: target.tag,
            moderatorId: w.moderatorId || 'Unknown',
            moderatorTag: 'Unknown',
            action: 'warn',
            reason: w.reason || 'بدون سبب',
            timestamp: w.timestamp || Date.now()
          });
        });
      }

      if (combined.length === 0) {
        return interaction.editReply({
          embeds: [info(`سجل العقوبات لـ **${target.tag}** فارغ ولا توجد أي عقوبات مسجلة`)]
        });
      }

      const itemsPerPage = 5;
      const totalPages = Math.ceil(combined.length / itemsPerPage);
      let page = 1;

      const getEmbed = (p) => {
        const start = (p - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = combined.slice(start, end);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`__سجل عقوبات العضو ${target.tag}__`)
          .setDescription(`الإجمالي: **${combined.length}** عقوبة`)
          .setThumbnail(target.displayAvatarURL({}))
          .setFooter({ text: `صفحة ${p} من ${totalPages}` })
          .setTimestamp();

        pageItems.forEach((item, index) => {
          const actionNames = {
            ban: '{emoji:circlex} **حظر (Ban)**',
            kick: '{emoji:circlex} **طرد (Kick)**',
            timeout: '{emoji:clock} **تايم أوت (Timeout)**',
            warn: '{emoji:alerttriangle} **تحذير (Warn)**',
            unban: '{emoji:circlecheck} **فك حظر (Unban)**',
            jail: '{emoji:lock} **سجن (Jail)**'
          };
          const actionName = actionNames[item.action] || `**${item.action.toUpperCase()}**`;
          const time = `<t:${Math.floor(item.timestamp / 1000)}:R>`;
          const mod = item.moderatorId ? `<@${item.moderatorId}>` : 'غير معروف';
          embed.addFields({
            name: `${start + index + 1}. ${actionName}`,
            value: `- **المشرف:** ${mod}\n- **السبب:** '${item.reason}'\n- **التاريخ:** ${time}`,
            inline: false
          });
        });

        return embed;
      };

      if (totalPages <= 1) {
        return interaction.editReply({ embeds: [getEmbed(1)] });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('السابق').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('التالي').setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.editReply({ embeds: [getEmbed(1)], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: '{emoji:circlex} لا يمكنك استخدام هذه الأزرار', flags: ['Ephemeral'] });
        }

        if (i.customId === 'prev') page--;
        if (i.customId === 'next') page++;

        row.components[0].setDisabled(page === 1);
        row.components[1].setDisabled(page === totalPages);

        await i.update({ embeds: [getEmbed(page)], components: [row] });
      });

      collector.on('end', () => {
        row.components.forEach((c) => c.setDisabled(true));
        interaction.editReply({ components: [row] }).catch(() => null);
      });
    } catch (err) {
      logger.error('[Command Error - history.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
