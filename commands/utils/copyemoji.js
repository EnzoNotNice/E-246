const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const emojis = require('../../utils/emojis.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('copyemoji')
        .setDescription('استخراج وتحميل الإيموجيات من النص كملف مضغوط')
        .addStringOption(option => 
            option.setName('emojis')
                .setDescription('ضع الإيموجيات هنا لاستخراجها')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const text = interaction.options.getString('emojis');
        const emojiRegex = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
        
        const foundEmojis = [];
        let match;

        while ((match = emojiRegex.exec(text)) !== null) {
            const isAnimated = match[1] === 'a';
            const name = match[2];
            const id = match[3];
            
            const ext = isAnimated ? 'gif' : 'png';
            const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
            
            foundEmojis.push({ name, url, ext, id });
        }

        if (foundEmojis.length === 0) {
            return interaction.editReply(`${emojis.circlex} لم يتم العثور على أي إيموجي مخصص في النص تأكد من وضع إيموجيات سيرفرات مخصصة`);
        }

        try {
            // Remove duplicates based on ID
            const uniqueEmojis = foundEmojis.filter((e, index, self) => 
                index === self.findIndex((t) => t.id === e.id)
            );

            const AdmZip = require('adm-zip');
            const zip = new AdmZip();

            // Fetch and append all emojis to the zip
            for (const emoji of uniqueEmojis) {
                const response = await fetch(emoji.url);
                if (!response.ok) continue;
                
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                zip.addFile(`${emoji.name}_${emoji.id}.${emoji.ext}`, buffer);
            }

            const zipBuffer = zip.toBuffer();

            const attachment = new AttachmentBuilder(zipBuffer, { name: `${interaction.user.username}.zip` });
            
            const embed = new EmbedBuilder()
                .setTitle(`${emojis.circlecheck} تم استخراج الإيموجيات`)
                .setDescription(`تم استخراج **${uniqueEmojis.length}** إيموجي بنجاح وتجميعها في ملف مضغوط جاهز للتحميل`)
                .setColor(0x5865F2);

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('Error in copyemoji:', error);
            await interaction.editReply(`${emojis.alerttriangle} حدث خطأ أثناء تجهيز الملف المضغوط`);
        }
    },
};
