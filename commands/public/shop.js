const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('متجر رتب السيرفر - تصفح وشراء وإدارة الرتب بالكريدت')
    .addSubcommand((sub) => sub.setName('view').setDescription('عرض وتصفح متجر رتب السيرفر وشراء الرتب بالكريدت'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('إضافة رتبة جديدة إلى متجر السيرفر (للإدارة)')
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة المعروضة للبيع').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('price').setDescription('سعر الرتبة بالكريدت').setRequired(true).setMinValue(1)
        )
        .addStringOption((o) =>
          o.setName('description').setDescription('وصف أو ميزة الرتبة في المتجر').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('إزالة رتبة من متجر السيرفر (للإدارة)')
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة المراد إزالتها').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('عرض جميع الرتب المعروضة في متجر السيرفر (للإدارة)')),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand(false) || 'view';
      const guild = interaction.guild;
      const guildId = guild.id;
      const userId = interaction.user.id;
      const member = interaction.member;

      // ──────────────── ADMIN SUBCOMMAND: ADD ────────────────
      if (sub === 'add') {
        if (
          !member.permissions.has(PermissionFlagsBits.ManageRoles) &&
          !member.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          return interaction.reply({ content: '❌ ليس لديك صلاحية إدارة الرتب لاستخدام هذا الأمر.', ephemeral: true });
        }
        const role = interaction.options.getRole('role');
        const price = interaction.options.getInteger('price');
        const description = interaction.options.getString('description') || 'رتبة مميزة في المتجر';

        if (role.managed || role.id === guild.id) {
          return interaction.reply({
            content: '❌ لا يمكن إضافة رتبة مدارة تلقائياً أو رتبة الجميع (@everyone) إلى المتجر.',
            ephemeral: true
          });
        }

        const botMember = guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
          return interaction.reply({
            content: '❌ لا يمكن إضافة رتبة أعلى من أو مساوية لأعلى رتبة يمتلكها البوت.',
            ephemeral: true
          });
        }

        db.addShopRole(guildId, role.id, price, description);

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('🛒 تم إضافة الرتبة إلى المتجر بنجاح')
          .setDescription(
            `تم عرض الرتبة في متجر السيرفر:\n\n` +
              `• **الرتبة:** <@&${role.id}>\n` +
              `• **السعر:** \`$${price.toLocaleString()}\` كريدت\n` +
              `• **الوصف:** ${description}`
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ──────────────── ADMIN SUBCOMMAND: REMOVE ────────────────
      if (sub === 'remove') {
        if (
          !member.permissions.has(PermissionFlagsBits.ManageRoles) &&
          !member.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          return interaction.reply({ content: '❌ ليس لديك صلاحية إدارة الرتب لاستخدام هذا الأمر.', ephemeral: true });
        }
        const role = interaction.options.getRole('role');
        const existing = db.getShopRole(guildId, role.id);

        if (!existing) {
          return interaction.reply({
            content: `❌ الرتبة <@&${role.id}> غير موجودة في متجر السيرفر.`,
            ephemeral: true
          });
        }

        db.removeShopRole(guildId, role.id);

        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('🗑️ تم إزالة الرتبة من المتجر')
          .setDescription(`تم حذف الرتبة <@&${role.id}> من متجر السيرفر ولن يتمكن الأعضاء من شرائها بعد الآن.`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ──────────────── ADMIN SUBCOMMAND: LIST ────────────────
      if (sub === 'list') {
        if (
          !member.permissions.has(PermissionFlagsBits.ManageRoles) &&
          !member.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          return interaction.reply({ content: '❌ ليس لديك صلاحية إدارة الرتب لاستخدام هذا الأمر.', ephemeral: true });
        }
        const shopRoles = db.getShopRoles(guildId);

        if (shopRoles.length === 0) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('🛒 متجر رتب السيرفر')
                .setDescription('لا توجد أي رتب مضافة للمتجر حالياً. يمكنك إضافة رتبة عبر `/shop add`.')
            ]
          });
        }

        const fields = shopRoles.slice(0, 25).map((r, i) => ({
          name: `${i + 1}. <@&${r.roleId}>`,
          value: `💰 **السعر:** \`$${r.price.toLocaleString()}\` كريدت\n📝 **الوصف:** ${r.description || 'بدون وصف'}`,
          inline: true
        }));

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🛒 رتب المتجر الحالية (${shopRoles.length})`)
          .setDescription('قائمة بجميع الرتب المعروضة للبيع بالكريدت في السيرفر:')
          .addFields(fields)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ──────────────── PUBLIC SUBCOMMAND: VIEW ────────────────
      const shopRoles = db.getShopRoles(guildId);
      const userBalance = (await db.getKV(`balance_${userId}`)) || 0;

      if (!shopRoles || shopRoles.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle('🛒 متجر رتب السيرفر')
              .setDescription('لا توجد أي رتب معروضة للبيع في متجر السيرفر حالياً.\nترقب إضافة رتب ومميزات قريباً!')
          ]
        });
      }

      // Filter and format available roles
      const menuOptions = [];
      const descriptionLines = [
        `مرحباً بك في متجر الرتب! رصيدك الحالي: \`$${userBalance.toLocaleString()}\` كريدت.\n`,
        '**الرتب المتاحة للشراء:**'
      ];

      for (let i = 0; i < shopRoles.length && i < 25; i++) {
        const item = shopRoles[i];
        const role = guild.roles.cache.get(item.roleId);
        const roleName = role ? role.name : `رتبة (${item.roleId})`;
        const alreadyOwned = member.roles.cache.has(item.roleId);
        const canAfford = userBalance >= item.price;

        const statusEmoji = alreadyOwned ? '✅ تمتلكها' : canAfford ? '🟢 متاحة' : '🔒 رصيد غير كافٍ';

        descriptionLines.push(
          `• <@&${item.roleId}> — **$${item.price.toLocaleString()}** [${statusEmoji}]\n  *${item.description || 'رتبة مميزة'}*`
        );

        menuOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${roleName.slice(0, 50)} - $${item.price.toLocaleString()}`)
            .setDescription((item.description || 'رتبة متجر').slice(0, 100))
            .setValue(item.roleId)
            .setEmoji(alreadyOwned ? '✅' : canAfford ? '💳' : '🔒')
        );
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`shop_buy_select:${userId}`)
        .setPlaceholder('اختر الرتبة التي ترغب بشرائها من القائمة...')
        .addOptions(menuOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🛒 متجر رتب السيرفر بالكريدت')
        .setDescription(descriptionLines.join('\n'))
        .setFooter({ text: 'اختر رتبتك من القائمة المنسدلة بالأسفل لإتمام عملية الشراء فورياً' })
        .setTimestamp();

      const response = await interaction.reply({
        embeds: [embed],
        components: [row]
      });

      // Collector for immediate selection handling
      const filter = (i) => i.customId === `shop_buy_select:${userId}` && i.user.id === userId;
      const collector = response.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 120000
      });

      collector.on('collect', async (i) => {
        try {
          const selectedRoleId = i.values[0];
          const roleItem = db.getShopRole(guildId, selectedRoleId);

          if (!roleItem) {
            return i.reply({
              content: '❌ لم تعد هذه الرتبة متوفرة في المتجر.',
              ephemeral: true
            });
          }

          if (i.member.roles.cache.has(selectedRoleId)) {
            return i.reply({
              content: `❌ أنت تمتلك بالفعل الرتبة <@&${selectedRoleId}>.`,
              ephemeral: true
            });
          }

          const currentBalance = (await db.getKV(`balance_${userId}`)) || 0;
          if (currentBalance < roleItem.price) {
            return i.reply({
              content: `❌ رصيدك الحالي (\`$${currentBalance.toLocaleString()}\`) غير كافٍ لشراء هذه الرتبة (\`$${roleItem.price.toLocaleString()}\`).`,
              ephemeral: true
            });
          }

          const targetRole =
            guild.roles.cache.get(selectedRoleId) || (await guild.roles.fetch(selectedRoleId).catch(() => null));

          if (!targetRole) {
            return i.reply({
              content: '❌ الرتبة غير موجودة في السيرفر حالياً.',
              ephemeral: true
            });
          }

          const botMember = guild.members.me;
          if (targetRole.position >= botMember.roles.highest.position) {
            return i.reply({
              content: '❌ لا يمكن للبوت منح هذه الرتبة لأنها أعلى من صلاحيات البوت الحالية.',
              ephemeral: true
            });
          }

          // Assign role to member safely first
          try {
            await i.member.roles.add(targetRole, 'Purchased from Server Role Shop with credits');
          } catch (err) {
            return i
              .reply({
                content: '❌ حدث خطأ أثناء محاولة منح الرتبة (تأكد من صلاحيات وترتيب رتبة البوت). لم يتم خصم أي رصيد.',
                ephemeral: true
              })
              .catch(() => null);
          }

          // Deduct credits atomically only after role is successfully granted
          const newBalance = currentBalance - roleItem.price;
          await db.setKV(`balance_${userId}`, newBalance);

          // Log transaction
          db.recordShopTransaction(guildId, userId, selectedRoleId, roleItem.price);

          const successEmbed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🎉 تم شراء الرتبة بنجاح!')
            .setDescription(
              `تهانينا! لقد قمت بشراء الرتبة <@&${selectedRoleId}> بنجاح.\n\n` +
                `• **المبلغ المدفوع:** \`$${roleItem.price.toLocaleString()}\` كريدت\n` +
                `• **رصيدك المتبقي:** \`$${newBalance.toLocaleString()}\` كريدت`
            )
            .setTimestamp();

          await i.reply({ embeds: [successEmbed] });
        } catch (err) {
          logger.error('[Shop Buy Collector Error]:', err);
          const replyPayload = { content: '❌ حدث خطأ أثناء إتمام عملية الشراء.', flags: ['Ephemeral'] };
          if (i.replied || i.deferred) {
            await i.followUp(replyPayload).catch(() => null);
          } else {
            await i.reply(replyPayload).catch(() => null);
          }
        }
      });

      collector.on('end', () => {
        // Disable menu after timeout
        const disabledMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
        const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
        interaction.editReply({ components: [disabledRow] }).catch(() => null);
      });
    } catch (err) {
      logger.error('[Shop Command Error]:', err);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: '❌ حدث خطأ أثناء فتح متجر الرتب.' }).catch(() => null);
      }
      return interaction.reply({ content: '❌ حدث خطأ أثناء فتح متجر الرتب.', flags: ['Ephemeral'] }).catch(() => null);
    }
  }
};
