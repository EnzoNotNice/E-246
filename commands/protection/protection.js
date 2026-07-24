const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('protection')
    .setDescription('إعداد الحماية التلقائية')
    .addSubcommand(s => s.setName('antilink').setDescription('إعداد منع الروابط')
      .addBooleanOption(o => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true))
      .addRoleOption(o => o.setName('bypass').setDescription('الرتبة المستثناة')))
    .addSubcommand(s => s.setName('antispam').setDescription('إعداد منع السبام')
      .addBooleanOption(o => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)))
    .addSubcommand(s => s.setName('antiraid').setDescription('إعداد منع الرايد')
      .addBooleanOption(o => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {  
      const sub = interaction.options.getSubcommand();
      const enabled = interaction.options.getBoolean('enabled');
      const bypass = interaction.options.getRole('bypass');
  
      const icons = { antilink: '{emoji:settings}', antispam: '{emoji:shield}', antiraid: '{emoji:shieldlock}' };
      const names = { antilink: 'حماية الروابط', antispam: 'حماية السبام', antiraid: 'حماية الريد' };
  
      db.db.prepare('INSERT INTO protection_settings (guildId) VALUES (?) ON CONFLICT(guildId) DO NOTHING').run(interaction.guildId);
  
      db.db.prepare(`UPDATE protection_settings SET ${sub} = ?, bypass_role = COALESCE(?, bypass_role) WHERE guildId = ?`)
        .run(enabled ? 1 : 0, bypass ? bypass.id : null, interaction.guildId);
  
      const embed = new EmbedBuilder()
        .setColor(enabled ? '#57F287' : '#ED4245')
        .setTitle(`${icons[sub]} ${names[sub]}`)
        .setDescription(`**${enabled ? 'تم تفعيل' : 'تم تعطيل'}** ${names[sub]}${bypass ? `\n**الرتبة المُعفاة** <@&${bypass.id}>` : ''}`)
        .setTimestamp();
  
      return interaction.reply({ embeds: [embed] });
    
    } catch (err) {
      console.error('[Command Error - protection.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
