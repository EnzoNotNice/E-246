const db = require('../../database/db');
const { createFakeInteraction } = require('../../utils/fakeInteraction');

module.exports = {
  name: 'اغنياء',
  aliases: ['top', 'الأغنياء', 'اغنى'],
  async execute(message, args) {
    const guildSettings = db.getGuildSettings(message.guild.id);
    const bankChannelId = guildSettings ? guildSettings.bank_channel : null;
    if (bankChannelId && message.channel.id !== bankChannelId) {
      return message.reply({ content: `{emoji:circlex} لا يمكنك استخدام أوامر البنك خارج الروم المخصص: <#${bankChannelId}>` }).catch(() => null);
    }
    const bankCmd = message.client.commands.get('bank');
    if (!bankCmd) return;
    const fakeInteraction = await createFakeInteraction(message, bankCmd, ['top', ...args]);
    await bankCmd.execute(fakeInteraction);
  }
};
