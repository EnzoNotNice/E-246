const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, ContainerBuilder, MediaGalleryBuilder, MessageFlags } = require('discord.js');
const { db } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lvtshow')
        .setDescription('Shows the live tracking interface (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const container = new ContainerBuilder()
            .setAccentColor(0x2f3136)
            .addMediaGalleryComponents((gallery) =>
                gallery.addItems((item) =>
                    item.setURL('https://cdn.discordapp.com/banners/1452821128228634831/00459844601ec84cb8d9e33fa07295b8.webp?size=1024')
                )
            )
            .addActionRowComponents((actionRow) =>
                actionRow.setComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('lvt_select')
                        .setPlaceholder('Make a selection...')
                        .addOptions([
                            {
                                label: 'Leaderboard',
                                value: 'lvt_leaderboard',
                                emoji: '<:white_trophy:1515385147900432574>',
                            },
                            {
                                label: 'MyLevel',
                                value: 'lvt_level',
                                emoji: '<:white_user:1515385140577046539>',
                            },
                            {
                                label: 'MyNitro',
                                value: 'lvt_nitro',
                                emoji: '1385470620254343239',
                            },
                            {
                                label: 'MyBoost',
                                value: 'lvt_boost',
                                emoji: '1386070844148678839',
                            },
                        ])
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
