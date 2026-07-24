const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tax')
    .setDescription('حساب ضريبة بروبوت')
    .addStringOption(o => o.setName('amount').setDescription('المبلغ للحساب').setRequired(true)),

  async execute(interaction) {
    try {  
      let amountStr = interaction.options.getString('amount').toLowerCase();
  
      let multiplier = 1;
      if (amountStr.endsWith('k')) multiplier = 1000;
      else if (amountStr.endsWith('m')) multiplier = 1000000;
      else if (amountStr.endsWith('b')) multiplier = 1000000000;
  
      let amount = parseFloat(amountStr.replace(/[^\d.]/g, '')) * multiplier;
  
      if (isNaN(amount) || amount <= 0) {
        return interaction.reply({ content: '{emoji:circlex} مبلغ غير صالح', flags: ['Ephemeral'] });
      }
  
      const priceWithTax = Math.floor(amount * (20 / 19) + 1);
  
      return interaction.reply({ content: `**الضريبة** \`${priceWithTax}\`` });
    
    } catch (err) {
      console.error('[Command Error - tax.js]:', err);
      if (interaction && typeof interaction.reply === 'function') {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
