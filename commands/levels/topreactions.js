const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topreactions')
        .setDescription('أكثر الأعضاء تفاعلاً'),
    async execute(interaction) {
        try {
            await interaction.deferReply().catch(() => null);
            const topUsers = db.prepare('SELECT * FROM levels WHERE guildId = ? ORDER BY reactionsCount DESC LIMIT 10').all(interaction.guild.id);

            if (!topUsers.length) {
                return interaction.editReply('❌ لا توجد إحصائيات للريأكشن في هذا السيرفر حتى الآن.').catch(() => null);
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'No One System', iconURL: 'https://cdn.discordapp.com/attachments/1504422687353733240/1514891340838866954/IMG_8528.png?ex=6a2d0400&is=6a2bb280&hm=59ee6f12df1261d81752ff2c19f93508791b078a621e5bc55fb24873d985b810&' })
                .setColor(0xFFFF00)
                .setTitle(`أكثر الأعضاء تفاعلاً في ${interaction.guild.name}`);

            let desc = '';
            topUsers.forEach((user, index) => {
                desc += `**${index + 1}.** <@${user.userId}> - ${user.reactionsCount || 0} reactions\n`;
            });
            
            embed.setDescription(desc);
            await interaction.editReply({ embeds: [embed] }).catch(() => null);
        } catch (err) {
            console.error('[topreactions Error]:', err);
        }
    },
};
