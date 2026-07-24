const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const locale = require('../../utils/locale');
const { error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('عرض تحذيرات العضو')
    .addUserOption(o => o.setName('user').setDescription('العضو للفحص').setRequired(true))
    .addBooleanOption(o => o.setName('clear').setDescription('حذف تحذيرات العضو'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {  
      const target = interaction.options.getUser('user');
      const clear = interaction.options.getBoolean('clear');
  
      if (clear) {
        db.clearWarnings(target.id, interaction.guildId);
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`{emoji:circlecheck} **تم مسح جميع تحذيرات العضو ${target.tag}**`)]
        });
      }
  
      const warnings = db.getWarnings(target.id, interaction.guildId);
      if (!warnings.length) return interaction.reply({ embeds: [error(locale.get('moderation.noWarnings'))], flags: ['Ephemeral'] });
  
      const desc = warnings.map((w, i) => {
        const date = new Date(w.timestamp * 1000).toLocaleDateString();
        return `**#${i + 1}** — ${w.reason}\n> المشرف: <@${w.moderatorId}> • ${date}`;
      }).join('\n\n');
  
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`{emoji:alerttriangle} تحذيرات ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(desc)
        .setFooter({ text: `الإجمالي: ${warnings.length} تحذير` })
        .setTimestamp();
  
      return interaction.reply({ embeds: [embed] });
    
    } catch (err) {
      console.error('[Command Error - warnings.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
