const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const activeGames = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mafia')
    .setDescription('لعبة مافيا'),

  async execute(interaction) {
    if (activeGames.has(interaction.channelId)) {
      return interaction.reply({ content: 'هناك لعبة جارية في هذا الروم حالياً', ephemeral: true });
    }

    activeGames.add(interaction.channelId);

    let players = [];
    let initialPlayers = [];
    let playerRoles = new Map();
    let playerInteractions = new Map();
    let isGameRunning = true;
    let currentRound = 1;

    let mafias = [];
    let doctor = null;
    let detector = null;
    let bodyguard = null;

    let mafiaAction = null;
    let doctorAction = null;
    let bodyguardAction = null;

    const embed = new EmbedBuilder()
      .setTitle('{emoji:star} لعبة مافيا')
      .setDescription(`**كيفية اللعب**\nاضغط على زر دخول للمشاركة\nسيتم توزيع الأدوار (مافيا، طبيب، محقق، حارس، مواطن) وتبدأ المواجهة ليلاً ونهاراً\n\n{emoji:clock} **لديك 30 ثانية للانضمام**`)
      .setColor(0x8C52FF)
      .addFields({ name: 'اللاعبون (0)', value: 'لا يوجد أحد بعد' });

    const joinBtn = new ButtonBuilder().setCustomId('m_join').setLabel('دخول للعبة').setStyle(ButtonStyle.Success);
    const leaveBtn = new ButtonBuilder().setCustomId('m_leave').setLabel('خروج من اللعبة').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
      if (i.customId === 'm_join') {
        if (players.length >= 12) {
          return i.reply({ content: 'عذراً، اكتمل العدد الأقصى للعبة (12 لاعب)', ephemeral: true }).catch(() => {});
        }
        if (!players.includes(i.user.id)) {
          players.push(i.user.id);
          playerInteractions.set(i.user.id, i);
        }
      } else if (i.customId === 'm_leave') {
        players = players.filter(id => id !== i.user.id);
        playerInteractions.delete(i.user.id);
      }
      
      const playersText = players.length > 0 ? players.map(id => `<@${id}>`).join('\n') : 'لا يوجد أحد بعد';
      const newEmbed = EmbedBuilder.from(embed).setFields({ name: `اللاعبون (${players.length})`, value: playersText });
      
      await i.update({ embeds: [newEmbed] }).catch(() => {});
    });

    collector.on('end', async () => {
      if (players.length < 5) {
        activeGames.delete(interaction.channelId);
        isGameRunning = false;
        return interaction.channel.send(`تم إلغاء اللعبة لعدم اكتمال العدد (مطلوب 5 لاعبين على الأقل)`).catch(() => {});
      }

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(joinBtn).setDisabled(true),
        ButtonBuilder.from(leaveBtn).setDisabled(true)
      );
      await msg.edit({ components: [disabledRow] }).catch(() => {});

      initialPlayers = [...players];
      await assignRoles();
    });

    async function assignRoles() {
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      
      mafias = [shuffled[0]];
      doctor = shuffled[1];
      detector = shuffled[2];
      bodyguard = shuffled[3];

      if (shuffled.length >= 8) {
        mafias.push(shuffled[4]);
      }

      for (const id of players) {
        let roleName = 'مواطن';
        if (mafias.includes(id)) roleName = 'مافيا';
        else if (id === doctor) roleName = 'طبيب';
        else if (id === detector) roleName = 'محقق';
        else if (id === bodyguard) roleName = 'حارس';

        playerRoles.set(id, roleName);

        const playerInt = playerInteractions.get(id);
        if (playerInt) {
          await playerInt.followUp({
            content: `🎭 **دورك في هذه اللعبة هو:** **${roleName}**`,
            ephemeral: true
          }).catch(() => {});
        }
      }

      const roleEmbed = new EmbedBuilder()
        .setTitle('📋 تم توزيع الأدوار بنجاح!')
        .setDescription('تم إرسال الأدوار لكل لاعب بشكل سري في رسالة خاصة/مخفية.\nتبدأ اللعبة الآن!')
        .setColor(0x8C52FF)
        .addFields(
          { name: '👥 عدد اللاعبين', value: `${players.length}`, inline: true },
          { name: '💀 المافيا', value: `${mafias.length}`, inline: true }
        );

      await interaction.channel.send({ embeds: [roleEmbed] });
      setTimeout(() => startNightPhase(), 5000);
    }

    async function startNightPhase() {
      if (!isGameRunning) return;

      mafiaAction = null;
      doctorAction = null;
      bodyguardAction = null;

      await interaction.channel.send(`🌌 **دخلنا في الليل... عيون الجميع مغلقة الآن والمافيا تستيقظ.**`);

      const aliveNonMafia = players.filter(id => !mafias.includes(id));
      const mafiaButtons = aliveNonMafia.map(id => {
        const username = interaction.guild.members.cache.get(id)?.user.username || 'لاعب';
        return new ButtonBuilder().setCustomId(`m_kill_${id}`).setLabel(username).setStyle(ButtonStyle.Danger);
      });
      const mafiaRows = chunk(mafiaButtons, 5);

      for (const mId of mafias) {
        const pInt = playerInteractions.get(mId);
        if (pInt) {
          await pInt.followUp({
            content: '💀 **المافيا: اختر لاعباً لقتله الليلة:**',
            components: mafiaRows,
            ephemeral: true
          }).catch(() => {});
        }
      }

      const docButtons = players.map(id => {
        const username = interaction.guild.members.cache.get(id)?.user.username || 'لاعب';
        return new ButtonBuilder().setCustomId(`m_save_${id}`).setLabel(username).setStyle(ButtonStyle.Success);
      });
      const docRows = chunk(docButtons, 5);

      if (players.includes(doctor)) {
        const pInt = playerInteractions.get(doctor);
        if (pInt) {
          await pInt.followUp({
            content: '💉 **الطبيب: اختر لاعباً لحمايته الليلة:**',
            components: docRows,
            ephemeral: true
          }).catch(() => {});
        }
      }

      const bgButtons = players.map(id => {
        const username = interaction.guild.members.cache.get(id)?.user.username || 'لاعب';
        return new ButtonBuilder().setCustomId(`m_shield_${id}`).setLabel(username).setStyle(ButtonStyle.Primary);
      });
      const bgRows = chunk(bgButtons, 5);

      if (players.includes(bodyguard)) {
        const pInt = playerInteractions.get(bodyguard);
        if (pInt) {
          await pInt.followUp({
            content: '🛡️ **الحارس: اختر لاعباً لتدريع حمايته:**',
            components: bgRows,
            ephemeral: true
          }).catch(() => {});
        }
      }

      const detButtons = players.filter(id => id !== detector).map(id => {
        const username = interaction.guild.members.cache.get(id)?.user.username || 'لاعب';
        return new ButtonBuilder().setCustomId(`m_check_${id}`).setLabel(username).setStyle(ButtonStyle.Secondary);
      });
      const detRows = chunk(detButtons, 5);

      if (players.includes(detector)) {
        const pInt = playerInteractions.get(detector);
        if (pInt) {
          await pInt.followUp({
            content: '🕵️‍♂️ **المحقق: اختر لاعباً للكشف عن هويته:**',
            components: detRows,
            ephemeral: true
          }).catch(() => {});
        }
      }

      const nightCollector = interaction.channel.createMessageComponentCollector({
        filter: i => ['m_kill_', 'm_save_', 'm_shield_', 'm_check_'].some(prefix => i.customId.startsWith(prefix)),
        time: 30000
      });

      nightCollector.on('collect', async i => {
        const userId = i.user.id;
        if (i.customId.startsWith('m_kill_')) {
          if (!mafias.includes(userId)) return i.reply({ content: 'لست مافيا!', ephemeral: true });
          mafiaAction = i.customId.replace('m_kill_', '');
          await i.update({ content: `✅ تم اختيار قتل <@${mafiaAction}>`, components: [] }).catch(() => {});
        } else if (i.customId.startsWith('m_save_')) {
          if (userId !== doctor) return i.reply({ content: 'لست الطبيب!', ephemeral: true });
          doctorAction = i.customId.replace('m_save_', '');
          await i.update({ content: `✅ تم اختيار حماية <@${doctorAction}>`, components: [] }).catch(() => {});
        } else if (i.customId.startsWith('m_shield_')) {
          if (userId !== bodyguard) return i.reply({ content: 'لست الحارس!', ephemeral: true });
          bodyguardAction = i.customId.replace('m_shield_', '');
          await i.update({ content: `✅ تم تدريع <@${bodyguardAction}>`, components: [] }).catch(() => {});
        } else if (i.customId.startsWith('m_check_')) {
          if (userId !== detector) return i.reply({ content: 'لست المحقق!', ephemeral: true });
          const target = i.customId.replace('m_check_', '');
          const isMafia = mafias.includes(target);
          await i.update({ content: `🕵️‍♂️ نتيجة التحقيق: <@${target}> هو **${isMafia ? 'مافيا 💀' : 'مواطن صالح 🛡️'}**`, components: [] }).catch(() => {});
        }
      });

      nightCollector.on('end', async () => {
        await startDayPhase();
      });
    }

    async function startDayPhase() {
      if (!isGameRunning) return;

      await interaction.channel.send(`🌅 **شروق الشمس! استيقظ الجميع لمعرفة ما حدث الليلة الماضية.**`);

      let killed = null;
      if (mafiaAction) {
        if (mafiaAction === doctorAction || mafiaAction === bodyguardAction) {
          await interaction.channel.send(`🛡️ **حاولت المافيا القتل ولكن تم إنقاذ الضحية بنجاح!**`);
        } else {
          killed = mafiaAction;
          players = players.filter(id => id !== killed);
          await interaction.channel.send(`💀 **وجدت الجثة! تم تصفية <@${killed}> الليلة الماضية.**`);
        }
      } else {
        await interaction.channel.send(`🛡️ **نامت المافيا دون القيام بأي اعتداء الليلة.**`);
      }

      if (checkWin()) return;

      setTimeout(() => startVotingPhase(), 5000);
    }

    async function startVotingPhase() {
      if (!isGameRunning) return;

      const buttons = players.map(id => {
        const username = interaction.guild.members.cache.get(id)?.user.username || 'لاعب';
        return new ButtonBuilder().setCustomId(`mvote_${id}`).setLabel(username).setStyle(ButtonStyle.Danger);
      });
      const rows = chunk(buttons, 5);

      await interaction.channel.send({
        content: `🗳️ **بدأت مرحلة التصويت! يرجى التصويت على الشخص المشتبه به بالمافيا:**`,
        components: rows
      });

      const votes = new Map();
      const voteCollector = interaction.channel.createMessageComponentCollector({
        filter: i => i.customId.startsWith('mvote_') && players.includes(i.user.id),
        time: 25000
      });

      voteCollector.on('collect', async i => {
        const voter = i.user.id;
        const target = i.customId.replace('mvote_', '');
        votes.set(voter, target);
        await i.reply({ content: `لقد صوتّ ضد <@${target}>`, ephemeral: true }).catch(() => {});
      });

      voteCollector.on('end', async () => {
        if (votes.size === 0) {
          await interaction.channel.send(`🗳️ **لم يصوت أحد! انتهى اليوم دون إعدام أحد.**`);
        } else {
          const counts = {};
          for (const target of votes.values()) {
            counts[target] = (counts[target] || 0) + 1;
          }
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          const highest = sorted[0];

          if (highest) {
            const executed = highest[0];
            players = players.filter(id => id !== executed);
            const role = playerRoles.get(executed);
            await interaction.channel.send(`💀 **بأغلبية الأصوات، تم إعدام <@${executed}> والذي كان دوره: **${role}****`);
          }
        }

        if (checkWin()) return;

        currentRound++;
        setTimeout(() => startNightPhase(), 5000);
      });
    }

    function checkWin() {
      const aliveMafias = players.filter(id => mafias.includes(id));
      const aliveCitizens = players.filter(id => !mafias.includes(id));

      if (aliveMafias.length === 0) {
        endGame(true);
        return true;
      }
      if (aliveMafias.length >= aliveCitizens.length) {
        endGame(false);
        return true;
      }
      return false;
    }

    async function endGame(citizensWon) {
      activeGames.delete(interaction.channelId);
      isGameRunning = false;

      const endEmbed = new EmbedBuilder()
        .setTitle(citizensWon ? '🎉 فاز المواطنون! 🎉' : '💀 فازت المافيا! 💀')
        .setDescription(citizensWon ? 'نجح المواطنون الصالحون في كشف المافيا وتصفيتها!' : 'تغلبت المافيا على المواطنين وسيطرت على المدينة!')
        .setColor(citizensWon ? 0x00FF00 : 0xFF0000)
        .addFields({
          name: 'الأدوار الأصلية للاعبين',
          value: initialPlayers.map(id => `<@${id}>: **${playerRoles.get(id)}**`).join('\n')
        });

      await interaction.channel.send({ embeds: [endEmbed] }).catch(() => {});
    }

    function chunk(arr, size) {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(new ActionRowBuilder().addComponents(arr.slice(i, i + size)));
      }
      return chunks;
    }
  }
};
