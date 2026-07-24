const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../database/db');
const { success, error } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alias')
    .setDescription('إدارة اختصارات الأوامر في السيرفر')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(sub => 
      sub.setName('add')
      .setDescription('إضافة اختصار جديد لأمر')
      .addStringOption(opt => opt.setName('command').setDescription('الأمر الأساسي (مثل ban)').setRequired(true))
      .addStringOption(opt => opt.setName('shortcut').setDescription('الاختصار (مثل باند)').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('remove')
      .setDescription('إزالة اختصار')
      .addStringOption(opt => opt.setName('shortcut').setDescription('الاختصار المراد حذفه').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('list')
      .setDescription('عرض قائمة الاختصارات الحالية')
    ),

  async execute(interaction) {
    try {  
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
  
      if (sub === 'add') {
        const command = interaction.options.getString('command').replace(/^\//, '');
        const shortcut = interaction.options.getString('shortcut').replace(/^#/, '');
  
        const baseCommandName = command.trim().split(/ +/)[0].toLowerCase();
        const baseCmd = interaction.client.commands.get(baseCommandName);
        if (!baseCmd) {
          return interaction.reply({ embeds: [error(`الأمر الأساسي \`${baseCommandName}\` غير موجود.`)], flags: ['Ephemeral'] });
        }
  
        db.addAlias(guildId, shortcut, command);
        return interaction.reply({ embeds: [success(`تمت إضافة الاختصار بنجاح!`, `يمكنك الآن استخدام \`#${shortcut}\` لتنفيذ أمر \`${command}\``)] });
      }
  
      if (sub === 'remove') {
        const shortcut = interaction.options.getString('shortcut').replace(/^#/, '');
        db.removeAlias(guildId, shortcut);
        return interaction.reply({ embeds: [success(`تم حذف الاختصار \`${shortcut}\` بنجاح.`)] });
      }
  
      if (sub === 'list') {
        const aliases = db.getAliases(guildId);
        if (!aliases.length) {
          return interaction.reply({ embeds: [error(`لا توجد اختصارات معدة في هذا السيرفر.`)], flags: ['Ephemeral'] });
        }
  
        const listStr = aliases.map(a => `**${a.shortcut}** ➔ \`${a.command}\``).join('\n');
        return interaction.reply({ embeds: [success(`قائمة الاختصارات`, listStr)] });
      }
    
    } catch (err) {
      console.error('[Command Error - alias.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
