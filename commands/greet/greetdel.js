const locale = require('../../utils/locale');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetdel')
    .setDescription('وقت حذف الترحيب')
    .addIntegerOption(o => o.setName('seconds').setDescription('ثواني قبل الحذف').setRequired(true).setMinValue(0).setMaxValue(300))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const secs = interaction.options.getInteger('seconds');
    db.getGreetSettings(interaction.guildId);
    db.db.prepare('UPDATE greet_settings SET delete_after = ? WHERE guildId = ?').run(secs, interaction.guildId);
    return interaction.reply({
      embeds: [success(secs ? locale.get('greet.autoDeleteSet', { secs }) : locale.get('greet.autoDeleteDisabled'))]
    });
  }
};
