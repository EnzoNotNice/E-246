const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topmessages')
        .setDescription('أكثر الأعضاء رسائل'),
    async execute(interaction) {
        try {
            const topUsers = db.prepare('SELECT * FROM levels WHERE guildId = ? ORDER BY messages DESC LIMIT 10').all(interaction.guild.id);

            if (!topUsers.length) {
                return interaction.reply('❌ لا توجد إحصائيات للرسائل في هذا السيرفر حتى الآن.');
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'No One System', iconURL: 'https://cdn.discordapp.com/attachments/1504422687353733240/1514891340838866954/IMG_8528.png?ex=6a2d0400&is=6a2bb280&hm=59ee6f12df1261d81752ff2c19f93508791b078a621e5bc55fb24873d985b810&' })
                .setColor(0x00BFFF)
                .setTitle(`Top Messages in ${interaction.guild.name}`);

            let desc = '';
            topUsers.forEach((user, index) => {
                desc += `**${index + 1}.** <@${user.userId}> - ${user.messages || 0} messages\n`;
            });
            
            embed.setDescription(desc);
            await interaction.reply({ embeds: [embed] }).catch(() => null);
        } catch (err) {
            console.error('[topmessages Error]:', err);
            await interaction.reply({ content: '❌ حدث خطأ أثناء إحضار البيانات.', flags: ['Ephemeral'] }).catch(() => null);
        }
    },
};
