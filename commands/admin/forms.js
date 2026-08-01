const logger = require('../../utils/logger');
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forms')
    .setDescription('إدارة التقديمات والاستمارات الإدارية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('إعداد روم سجل التقديمات والرتبة المطلوبة')
        .addChannelOption((o) =>
          o
            .setName('log-channel')
            .setDescription('روم استقبال طلبات التقديم')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((o) =>
          o.setName('accept-role').setDescription('الرتبة التي تمنح للعضو عند قبول طلبه').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('question-add')
        .setDescription('إضافة سؤال جديد للاستمارة (الحد الأقصى 5 أسئلة)')
        .addStringOption((o) => o.setName('text').setDescription('نص السؤال').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('style')
            .setDescription('طول الإجابة')
            .addChoices(
              { name: 'سطر واحد (Short)', value: 'SHORT' },
              { name: 'فقرة طويلة (Paragraph)', value: 'PARAGRAPH' }
            )
            .setRequired(false)
        )
        .addBooleanOption((o) => o.setName('required').setDescription('هل السؤال إجباري؟').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('question-clear').setDescription('مسح كافة الأسئلة المضافة للاستمارة'))
    .addSubcommand((sub) =>
      sub
        .setName('send')
        .setDescription('إرسال لوحة التقديم في روم معين')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('الروم المراد إرسال لوحة التقديم فيه')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((o) => o.setName('title').setDescription('عنوان لوحة التقديم').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('وصف لوحة التقديم').setRequired(false))
    ),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: ['Ephemeral'] }).catch(() => null);

      const settings = db.getFormsSettings(interaction.guildId);

      if (subcommand === 'setup') {
        const logChannel = interaction.options.getChannel('log-channel');
        const acceptRole = interaction.options.getRole('accept-role');

        const panelData = settings.panel_data || {};
        if (acceptRole) {
          panelData.accept_role = acceptRole.id;
        }

        db.updateFormsSettings(interaction.guildId, {
          log_channel: logChannel.id,
          panel_data: panelData
        });

        return interaction.editReply({
          embeds: [
            success(
              `تم حفظ إعدادات الاستمارة بنجاح\n\n- **روم استقبال الطلبات:** <#${logChannel.id}>\n- **رتبة القبول التلقائي:** ${acceptRole ? `<@&${acceptRole.id}>` : 'غير محددة'}`
            )
          ]
        });
      }

      if (subcommand === 'question-add') {
        const text = interaction.options.getString('text');
        const style = interaction.options.getString('style') || 'PARAGRAPH';
        const required = interaction.options.getBoolean('required') ?? true;

        const questions = settings.questions || [];
        if (questions.length >= 5) {
          return interaction.editReply({
            embeds: [error('لا يمكنك إضافة أكثر من 5 أسئلة (حد أقصى من ديسكورد)')]
          });
        }

        questions.push({ label: text, placeholder: 'اكتب إجابتك هنا', style, required });
        db.updateFormsSettings(interaction.guildId, { questions });

        return interaction.editReply({
          embeds: [
            success(
              `تم إضافة السؤال بنجاح\n\n- **السؤال:** ${text}\n- **النوع:** ${style === 'SHORT' ? 'سطر واحد' : 'فقرة طويلة'}\n- **إجباري:** ${required ? 'نعم' : 'لا'}\n- **عدد الأسئلة الحالي:** ${questions.length}/5`
            )
          ]
        });
      }

      if (subcommand === 'question-clear') {
        db.updateFormsSettings(interaction.guildId, { questions: [] });
        return interaction.editReply({
          embeds: [success('تم تفريغ كافة أسئلة التقديم بنجاح')]
        });
      }

      if (subcommand === 'send') {
        const targetChannel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title') || 'لوحة التقديمات الإدارية';
        const description =
          interaction.options.getString('description') || 'اضغط على الزر أدناه لفتح استمارة التقديم على الإدارة';

        const questions = settings.questions || [];
        if (questions.length === 0) {
          return interaction.editReply({
            embeds: [error('لا يمكنك إرسال اللوحة قبل إضافة سؤال واحد على الأقل')]
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`__${title}__`)
          .setDescription(description)
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({}) })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('form_apply').setLabel('تقديم طلب 📝').setStyle(ButtonStyle.Success)
        );

        await targetChannel.send({ embeds: [embed], components: [row] });

        return interaction.editReply({
          embeds: [success(`تم إرسال لوحة التقديم بنجاح إلى الروم <#${targetChannel.id}>`)]
        });
      }
    } catch (err) {
      logger.error('[Command Error - forms.js]:', err);
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
      await reply({ content: '{emoji:circlex} حدث خطأ أثناء تنفيذ هذا الأمر', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
