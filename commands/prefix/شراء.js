const db = require('../../database/db');
const { createFakeInteraction } = require('../../utils/fakeInteraction');

module.exports = {
  name: 'شراء',
  aliases: ['buy', 'تسوق'],
  async execute(message, args) {
    try {  
      const guildSettings = db.getGuildSettings(message.guild.id);
      const bankChannelId = guildSettings ? guildSettings.bank_channel : null;
      if (bankChannelId && message.channel.id !== bankChannelId) {
        return message.reply({ content: `{emoji:circlex} لا يمكنك استخدام أوامر البنك خارج الروم المخصص: <#${bankChannelId}>` }).catch(() => null);
      }
      const bankCmd = message.client.commands.get('bank');
      if (!bankCmd) return;
      const fakeInteraction = await createFakeInteraction(message, bankCmd, ['buy', ...args]);
      await bankCmd.execute(fakeInteraction);
    
    } catch (err) {
      console.error('[Command Error - شراء.js]:', err);
      if (message && typeof message.reply === 'function') {
        await message.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', flags: ['Ephemeral'] }).catch(() => null);
      }
    }
}
};
