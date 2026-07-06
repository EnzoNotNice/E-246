const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { success, error } = require('../../utils/embeds');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('نظام السجن والاستدعاء')
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('إعداد نظام السجن')
        .addRoleOption(o => o.setName('role').setDescription('رتبة السجن (Jailed Role)').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('روم السجن الكتابي').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addChannelOption(o => o.setName('staff_voice').setDescription('روم الاستدعاء الصوتي للإدارة').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('سجن عضو')
        .addUserOption(o => o.setName('user').setDescription('العضو المراد سجنه').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('فك سجن عضو')
        .addUserOption(o => o.setName('user').setDescription('العضو المراد فك سجنه').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('summon')
        .setDescription('استدعاء عضو مسجون')
        .addUserOption(o => o.setName('user').setDescription('العضو المراد استدعاؤه').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'setup') {
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');
      const staffVoice = interaction.options.getChannel('staff_voice');

      db.setJailSettings(guild.id, role.id, channel.id, staffVoice ? staffVoice.id : null);

      return interaction.reply({
        embeds: [success(`تم إعداد نظام السجن بنجاح\n\n**الرتبة** <@&${role.id}>\n**روم السجن** <#${channel.id}>\n**روم الاستدعاء** ${staffVoice ? `<#${staffVoice.id}>` : 'غير محدد'}`)]
      });
    }

    const settings = db.getJailSettings(guild.id);
    if (!settings || !settings.jailRoleId || !settings.jailChannelId) {
      return interaction.reply({ embeds: [error('يرجى إعداد نظام السجن أولاً باستخدام `/jail setup`')], flags: ['Ephemeral'] });
    }

    const targetUser = interaction.options.getUser('user');
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ embeds: [error('العضو غير موجود في السيرفر')], flags: ['Ephemeral'] });
    }

    if (sub === 'add') {
      if (targetMember.id === interaction.user.id) {
        return interaction.reply({ embeds: [error('لا يمكنك سجن نفسك')], flags: ['Ephemeral'] });
      }

      if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== guild.ownerId) {
        return interaction.reply({ embeds: [error('لا تملك الصلاحية لسجن هذا العضو بسبب رتبته')], flags: ['Ephemeral'] });
      }

      const isJailed = db.getJailedUser(targetMember.id, guild.id);
      if (isJailed || targetMember.roles.cache.has(settings.jailRoleId)) {
        return interaction.reply({ embeds: [error('هذا العضو مسجون بالفعل')], flags: ['Ephemeral'] });
      }

      const reason = interaction.options.getString('reason') || 'لا يوجد سبب';
      const originalRoles = targetMember.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);

      db.addJailedUser(targetMember.id, guild.id, JSON.stringify(originalRoles));

      try {
        await targetMember.roles.set([settings.jailRoleId], reason);
      } catch (err) {
        db.removeJailedUser(targetMember.id, guild.id);
        return interaction.reply({ embeds: [error('فشل في إزالة رتب العضو أو إعطائه رتبة السجن تأكد من صلاحيات البوت ترتيب رتبته')], flags: ['Ephemeral'] });
      }

      const jailChannel = guild.channels.cache.get(settings.jailChannelId);
      if (jailChannel) {
        jailChannel.send({
          content: `<@${targetMember.id}>`,
          embeds: [
            new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('{emoji:lock} تم دخولك السجن')
              .setDescription(`لقد تم سجنك بواسطة <@${interaction.user.id}>\n**السبب** ${reason}`)
              .setTimestamp()
          ]
        }).catch(() => null);
      }

      return interaction.reply({ embeds: [success(`تم سجن العضو <@${targetMember.id}> بنجاح`)] });
    }

    if (sub === 'remove') {
      const jailedData = db.getJailedUser(targetMember.id, guild.id);
      if (!jailedData && !targetMember.roles.cache.has(settings.jailRoleId)) {
        return interaction.reply({ embeds: [error('هذا العضو ليس مسجوناً')], flags: ['Ephemeral'] });
      }

      let rolesToRestore = [];
      if (jailedData && jailedData.oldRoles) {
        try {
          rolesToRestore = JSON.parse(jailedData.oldRoles);
        } catch (e) {}
      }

      try {
        await targetMember.roles.set(rolesToRestore);
      } catch (err) {
        await targetMember.roles.remove(settings.jailRoleId).catch(() => null);
      }

      db.removeJailedUser(targetMember.id, guild.id);
      return interaction.reply({ embeds: [success(`تم فك سجن العضو <@${targetMember.id}> بنجاح وإعادة رتبه`)] });
    }

    if (sub === 'summon') {
      const jailedData = db.getJailedUser(targetMember.id, guild.id);
      if (!jailedData && !targetMember.roles.cache.has(settings.jailRoleId)) {
        return interaction.reply({ embeds: [error('هذا العضو ليس مسجوناً لاستدعائه')], flags: ['Ephemeral'] });
      }

      const jailChannel = guild.channels.cache.get(settings.jailChannelId);
      if (jailChannel) {
        jailChannel.send({
          content: `<@${targetMember.id}>`,
          embeds: [
            new EmbedBuilder()
              .setColor('#57F287')
              .setTitle('{emoji:bellringing} استدعاء من الإدارة')
              .setDescription(`تم استدعاؤك بواسطة الإداري <@${interaction.user.id}>\nيرجى التجاوب فوراً`)
              .setTimestamp()
          ]
        }).catch(() => null);
      }

      if (targetMember.voice.channel) {
        if (settings.staffVoiceId) {
          const staffVC = guild.channels.cache.get(settings.staffVoiceId);
          if (staffVC) {
            await targetMember.voice.setChannel(staffVC).catch(() => null);
          }
        }
      }

      return interaction.reply({ embeds: [success(`تم استدعاء العضو <@${targetMember.id}> وإرسال التنبيه`)] });
    }
  }
};
