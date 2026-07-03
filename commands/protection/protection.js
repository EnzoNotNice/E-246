const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('protection')
    .setDescription('إعداد قواعد حماية المود التلقائي')
    .addSubcommand(s => s.setName('antilink').setDescription('تفعيل أو تعطيل حماية منع الروابط')
      .addBooleanOption(o => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true))
      .addRoleOption(o => o.setName('bypass').setDescription('الرتبة المستثناة من هذه القاعدة')))
    .addSubcommand(s => s.setName('antispam').setDescription('تفعيل أو تعطيل حماية منع السبام')
      .addBooleanOption(o => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)))
    .addSubcommand(s => s.setName('antiraid').setDescription('تفعيل أو تعطيل حماية منع الرايد')
      .addBooleanOption(o => o.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const enabled = interaction.options.getBoolean('enabled');
    const bypass = interaction.options.getRole('bypass');

    const icons = { antilink: '<:settings:1519212212227407953>', antispam: '<:shield:1519212202676977788>', antiraid: '<:shieldlock:1519212205638287522>' };
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
  }
};
