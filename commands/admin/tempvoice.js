const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('إعداد الرومات المؤقتة')
    .addSubcommand(sub => 
        sub.setName('setup')
        .setDescription('إعداد روم الصناعة')
        .addChannelOption(opt => 
            opt.setName('master_channel')
            .setDescription('الروم الصوتي الأساسي')
            .setRequired(true)
        )
        .addChannelOption(opt => 
            opt.setName('category')
            .setDescription('قسم الرومات الجديدة')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
        sub.setName('panel')
        .setDescription('إرسال بانل الرومات')
        .addChannelOption(opt =>
            opt.setName('channel')
            .setDescription('روم إرسال البانل')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
        const masterChannel = interaction.options.getChannel('master_channel');
        const category = interaction.options.getChannel('category');

        if (masterChannel.type !== 2) {
            return interaction.reply({ embeds: [error('يرجى تحديد قناة صوتية صحيحة كغرفة أساسية')], flags: ['Ephemeral'] });
        }
        if (category.type !== 4) { 
            return interaction.reply({ embeds: [error('يرجى تحديد قسم (Category) صحيح')], flags: ['Ephemeral'] });
        }

        db.updateTempVoiceSettings(interaction.guildId, masterChannel.id, category.id);

        const embed = success(`تم إعداد الغرف الصوتية المؤقتة بنجاح\n\nالغرفة الأساسية <#${masterChannel.id}>\nالقسم **${category.name}**`);
        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'panel') {
        const channel = interaction.options.getChannel('channel');
        db.updateTempVoicePanel(interaction.guildId, channel.id);

        const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const { generateTVControlPanel } = require('../../utils/tvCanvas');
        const emojis = require('../../utils/emojis.json');

        const buffer = await generateTVControlPanel();
        const attachment = new AttachmentBuilder(buffer, { name: 'control_panel.png' });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tv_lock').setEmoji(emojis.tv_lock || '🔒').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tv_unlock').setEmoji(emojis.tv_unlock || '🔓').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tv_hide').setEmoji(emojis.tv_hide || '👁️‍🗨️').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tv_show').setEmoji(emojis.tv_show || '👁️').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tv_limit').setEmoji(emojis.tv_limit || '👥').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tv_rename').setEmoji(emojis.tv_rename || '✏️').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tv_kick').setEmoji(emojis.tv_kick || '👢').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tv_trust').setEmoji(emojis.tv_trust || '👑').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tv_ban').setEmoji(emojis.tv_ban || '🚫').setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ files: [attachment], components: [row1, row2] });

        return interaction.reply({ embeds: [success(`تم إرسال لوحة التحكم بنجاح في روم <#${channel.id}>`)], flags: ['Ephemeral'] });
    }
  }
};
