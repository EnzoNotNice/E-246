const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const db = require("../../database/db")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unblacklist")
        .setDescription("إزالة مستخدم من قائمة حظر التذاكر")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("المستخدم")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const isBlacklisted =
    db.isTicketBlacklisted(
        interaction.guild.id,
        user.id
    );

if (!isBlacklisted) {

    return interaction.reply({
        content:
            "❌ هذا المستخدم غير موجود في قائمة الحظر",
        ephemeral: true
    });

}

        const user =
            interaction.options.getUser("user");

        await db.removeTicketBlacklist(
            interaction.guild.id,
            user.id
        );

        

        return interaction.reply({
            content:
                `✅ تم إزالة ${user.tag} من قائمة حظر التذاكر`,
            ephemeral: true
        });

    }
};