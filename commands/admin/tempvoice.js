const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const locale = require('../../utils/locale');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('إعدادات الغرف الصوتية المؤقتة (Join to Create)')
    .addSubcommand(sub => 
        sub.setName('setup')
        .setDescription('إعداد الغرفة الأساسية لصناعة الرومات')
        .addChannelOption(opt => 
            opt.setName('master_channel')
            .setDescription('الروم الصوتي الأساسي (انضم لتصنع روم)')
            .setRequired(true)
        )
        .addChannelOption(opt => 
            opt.setName('category')
            .setDescription('القسم الذي ستصنع فيه الرومات الجديدة')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'setup') {
        const masterChannel = interaction.options.getChannel('master_channel');
        const category = interaction.options.getChannel('category');

        if (masterChannel.type !== 2) {
            return interaction.reply({ embeds: [error('يرجى تحديد قناة صوتية صحيحة كغرفة أساسية.')], flags: ['Ephemeral'] });
        }
        if (category.type !== 4) { 
            return interaction.reply({ embeds: [error('يرجى تحديد قسم (Category) صحيح.')], flags: ['Ephemeral'] });
        }

        db.updateTempVoiceSettings(interaction.guildId, masterChannel.id, category.id);

        const embed = success(`تم إعداد الغرف الصوتية المؤقتة بنجاح!\n\nالغرفة الأساسية: <#${masterChannel.id}>\nالقسم: **${category.name}**`);
        await interaction.reply({ embeds: [embed] });
    }
  }
};
