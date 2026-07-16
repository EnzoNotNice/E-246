const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const jobTitles = [
  { name: 'ملك', cost: 50000, salary: 5000 },
  { name: 'امير', cost: 45000, salary: 4500 },
  { name: 'طيار', cost: 40000, salary: 4000 },
  { name: 'قاضي', cost: 35000, salary: 3500 },
  { name: 'مبرمج', cost: 30000, salary: 3000 },
  { name: 'دكتور', cost: 30000, salary: 3000 },
  { name: 'مهندس', cost: 25000, salary: 2500 },
  { name: 'معلم', cost: 20000, salary: 2000 },
  { name: 'جندي', cost: 15000, salary: 1500 },
  { name: 'طباخ', cost: 10000, salary: 1000 },
  { name: 'رسام', cost: 8000, salary: 800 }
];

const companiesData = [
  { id: 1, name: 'شركة النخبة', price: 100000000, rent: 50000000 },
  { id: 2, name: 'شركة ريال مدريد', price: 100000000, rent: 50000000 },
  { id: 3, name: 'شركة الأمل', price: 100000000, rent: 50000000 },
  { id: 4, name: 'شركة المستقبل', price: 100000000, rent: 50000000 },
  { id: 5, name: 'شركة الأمان', price: 100000000, rent: 50000000 },
  { id: 6, name: 'شركة السعادة', price: 100000000, rent: 50000000 },
  { id: 7, name: 'شركة الصقر', price: 100000000, rent: 50000000 },
  { id: 8, name: 'شركة النجوم', price: 100000000, rent: 50000000 },
  { id: 9, name: 'شركة الهلال', price: 100000000, rent: 50000000 },
  { id: 10, name: 'شركة الإعمار', price: 100000000, rent: 50000000 }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('نظام البنك والألعاب المالية')
    .addSubcommand(sub => sub
      .setName('balance')
      .setDescription('عرض رصيدك المالي الحالي')
    )
    .addSubcommand(sub => sub
      .setName('daily')
      .setDescription('الحصول على الهدية اليومية')
    )
    .addSubcommand(sub => sub
      .setName('transfer')
      .setDescription('تحويل مبلغ مالي لشخص آخر')
      .addUserOption(opt => opt.setName('user').setDescription('الشخص المراد التحويل له').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ المراد تحويله').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub
      .setName('salary')
      .setDescription('استلام الراتب للوظيفة الحالية ومداخيلك العقارية والاستثمارية')
    )
    .addSubcommand(sub => sub
      .setName('job')
      .setDescription('العمل واختيار الوظائف')
      .addStringOption(opt => opt.setName('action').setDescription('الإجراء المطلوب').setRequired(true)
        .addChoices(
          { name: 'عرض قائمة الوظائف', value: 'list' },
          { name: 'شراء وظيفة جديدة', value: 'buy' }
        )
      )
      .addStringOption(opt => opt.setName('name').setDescription('اسم الوظيفة لشراءها').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('loan')
      .setDescription('أخذ قرض مالي قيمته $100,000')
    )
    .addSubcommand(sub => sub
      .setName('payloan')
      .setDescription('تسديد القرض الحالي المتبقي عليك')
    )
    .addSubcommand(sub => sub
      .setName('invest')
      .setDescription('استثمار أموالك في البورصة')
      .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ المراد استثماره').setRequired(true).setMinValue(100))
    )
    .addSubcommand(sub => sub
      .setName('trade')
      .setDescription('تداول العملات والأسهم')
      .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ المراد تداوله').setRequired(true).setMinValue(100))
    )
    .addSubcommand(sub => sub
      .setName('buy')
      .setDescription('شراء منزل أو شركة لزيادة دخلك')
      .addStringOption(opt => opt.setName('type').setDescription('نوع العقار').setRequired(true)
        .addChoices(
          { name: 'شراء منزل ($1,000,000)', value: 'house' },
          { name: 'شراء شركة ($100,000,000)', value: 'company' }
        )
      )
      .addIntegerOption(opt => opt.setName('id').setDescription('رقم الشركة لشراءها (فقط للشركات)').setRequired(false).setMinValue(1).setMaxValue(10))
    )
    .addSubcommand(sub => sub
      .setName('companies')
      .setDescription('عرض قائمة الشركات الاستثمارية وحالتها')
    )
    .addSubcommand(sub => sub
      .setName('gamble')
      .setDescription('المقامرة بمبلغ مالي')
      .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ المراد المراهنة به').setRequired(true).setMinValue(10))
    )
    .addSubcommand(sub => sub
      .setName('dice')
      .setDescription('لعبة رمي النرد')
      .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ المراد المراهنة به').setRequired(true).setMinValue(10))
    )
    .addSubcommand(sub => sub
      .setName('coinflip')
      .setDescription('لعبة رمي العملة المعدنية (حظ)')
      .addIntegerOption(opt => opt.setName('amount').setDescription('المبلغ المراد المراهنة به').setRequired(true).setMinValue(10))
    )
    .addSubcommand(sub => sub
      .setName('rob')
      .setDescription('محاولة نهب وسرقة رصيد عضو آخر')
      .addUserOption(opt => opt.setName('user').setDescription('العضو المراد سرقته').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('protect')
      .setDescription('شراء درع حماية لحماية حسابك من السرقة والنهب')
      .addIntegerOption(opt => opt.setName('hours').setDescription('عدد الساعات (سعر الساعة $500,000 بحد أقصى 3 ساعات)').setRequired(true).setMinValue(1).setMaxValue(3))
    )
    .addSubcommand(sub => sub
      .setName('top')
      .setDescription('عرض قائمة أغنى الأعضاء في السيرفر')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    const guildSettings = db.getGuildSettings(interaction.guildId);
    const bankChannelId = guildSettings ? guildSettings.bank_channel : null;
    if (bankChannelId && interaction.channelId !== bankChannelId) {
      return interaction.reply({ content: `{emoji:circlex} لا يمكنك استخدام أوامر البنك خارج الروم المخصص: <#${bankChannelId}>`, ephemeral: true });
    }

    let userBalance = await db.getKV(`balance_${userId}`) || 0;

    const loanRepayTime = await db.getKV(`loan_repay_${userId}`);
    if (loanRepayTime && Date.now() > loanRepayTime) {
      const outstandingLoan = await db.getKV(`loan_${userId}`);
      if (outstandingLoan) {
        userBalance = Math.max(0, userBalance - outstandingLoan);
        await db.setKV(`balance_${userId}`, userBalance);
        await db.deleteKV(`loan_${userId}`);
        await db.deleteKV(`loan_repay_${userId}`);
        await interaction.channel.send({ content: `{emoji:alerttriangle} <@${userId}> تم استقطاع مبلغ القرض التلقائي المتبقي بقيمة $${outstandingLoan.toLocaleString()} من حسابك لانتهاء مدة السداد (ساعة واحدة).` }).catch(() => null);
      }
    }

    if (subcommand === 'balance') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('💳 الحساب البنكي')
            .setDescription(`مرحباً <@${userId}>، إليك رصيدك المالي الحالي:\n\n💸 **الرصيد الكلي:** \`$${userBalance.toLocaleString()}\``)
            .setColor(0x8C52FF)
            .setTimestamp()
        ]
      });
    }

    if (subcommand === 'daily') {
      const cooldownKey = `cooldown_daily_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 172800000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار للحصول على الهدية اليومية مرة أخرى. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      const giftAmount = Math.floor(Math.random() * 4000) + 1000;
      userBalance += giftAmount;

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(cooldownKey, now);

      return interaction.reply({
        content: `{emoji:gift} لقد حصلت على الهدية اليومية بقيمة **$${giftAmount.toLocaleString()}**!\nرصيدك الحالي هو **$${userBalance.toLocaleString()}**.`
      });
    }

    if (subcommand === 'transfer') {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (targetUser.bot || targetUser.id === userId) {
        return interaction.reply({ content: '{emoji:circlex} لا يمكنك تحويل الأموال لنفسك أو لبوت.', ephemeral: true });
      }

      if (userBalance < amount) {
        return interaction.reply({ content: `{emoji:circlex} رصيدك الحالي غير كافٍ. رصيدك الحالي: **$${userBalance.toLocaleString()}**`, ephemeral: true });
      }

      const outstandingLoan = await db.getKV(`loan_${userId}`);
      if (outstandingLoan && outstandingLoan > 0) {
        return interaction.reply({ content: '{emoji:circlex} لا يمكنك تحويل الأموال وأنت مطالب بتسديد قرض نشط للبنك.', ephemeral: true });
      }

      const tax = Math.floor(amount * 0.20);
      const netAmount = amount - tax;

      userBalance -= amount;
      let targetBalance = await db.getKV(`balance_${targetUser.id}`) || 0;
      targetBalance += netAmount;

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(`balance_${targetUser.id}`, targetBalance);

      return interaction.reply({
        content: `💸 تم تحويل **$${netAmount.toLocaleString()}** إلى <@${targetUser.id}> بعد خصم ضريبة تحويل 20% بقيمة **$${tax.toLocaleString()}**.`
      });
    }

    if (subcommand === 'salary') {
      const cooldownKey = `cooldown_salary_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 86400000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار لاستلام الراتب مرة أخرى. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      const jobName = await db.getKV(`job_${userId}`);
      let salary = 500;
      if (jobName) {
        const jobInfo = jobTitles.find(j => j.name === jobName);
        if (jobInfo) salary = jobInfo.salary;
      }

      const userHouses = await db.getKV(`user_houses_${userId}`) || 0;
      const houseIncome = userHouses * 200000;

      let companyIncome = 0;
      for (const comp of companiesData) {
        const owner = await db.getKV(`company_${comp.id}_owner`);
        if (owner === userId) {
          companyIncome += comp.rent;
        }
      }

      const totalIncome = salary + houseIncome + companyIncome;
      userBalance += totalIncome;

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(cooldownKey, now);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('{emoji:briefcase} كشف الراتب والمداخيل')
            .setDescription(`مرحباً <@${userId}>، تم إيداع مداخيلك اليومية في حسابك:`)
            .addFields(
              { name: '{emoji:briefcase} راتب الوظيفة الحالية', value: `$${salary.toLocaleString()}`, inline: true },
              { name: '{emoji:briefcase} أرباح العقارات والمنازل', value: `$${houseIncome.toLocaleString()}`, inline: true },
              { name: '{emoji:briefcase} أرباح الشركات المملوكة', value: `$${companyIncome.toLocaleString()}`, inline: true },
              { name: '{emoji:chartpie} مجموع الدخل المودع', value: `$${totalIncome.toLocaleString()}`, inline: false }
            )
            .setColor(0x00FF00)
            .setFooter({ text: `رصيدك الحالي: $${userBalance.toLocaleString()}` })
        ]
      });
    }

    if (subcommand === 'job') {
      const action = interaction.options.getString('action');

      if (action === 'list') {
        const embed = new EmbedBuilder()
          .setTitle('💼 قائمة الوظائف المتاحة')
          .setDescription('شراء الوظائف ذات التكلفة الأعلى يمنحك راتباً يومياً أكبر!')
          .setColor(0x8C52FF);

        for (const job of jobTitles) {
          embed.addFields({ name: `💼 وظيفة: ${job.name}`, value: `💵 التكلفة: **$${job.cost.toLocaleString()}** | 📈 الراتب اليومي: **$${job.salary.toLocaleString()}**` });
        }

        return interaction.reply({ embeds: [embed] });
      }

      if (action === 'buy') {
        const jobName = interaction.options.getString('name');
        if (!jobName) {
          return interaction.reply({ content: '{emoji:circlex} يرجى كتابة اسم الوظيفة التي تود شراءها بشكل صحيح.', ephemeral: true });
        }

        const jobInfo = jobTitles.find(j => j.name.trim() === jobName.trim());
        if (!jobInfo) {
          return interaction.reply({ content: '{emoji:circlex} لم يتم العثور على الوظيفة المطلوبة بقائمة الوظائف.', ephemeral: true });
        }

        if (userBalance < jobInfo.cost) {
          return interaction.reply({ content: `{emoji:circlex} رصيدك غير كافٍ لشراء الوظيفة. التكلفة: **$${jobInfo.cost.toLocaleString()}**`, ephemeral: true });
        }

        userBalance -= jobInfo.cost;
        await db.setKV(`balance_${userId}`, userBalance);
        await db.setKV(`job_${userId}`, jobInfo.name);

        return interaction.reply({
          content: `{emoji:briefcase} مبروك! لقد اشتريت وظيفة **${jobInfo.name}** بنجاح.\nراتبك اليومي الجديد هو **$${jobInfo.salary.toLocaleString()}**.`
        });
      }
    }

    if (subcommand === 'loan') {
      const existingLoan = await db.getKV(`loan_${userId}`);
      if (existingLoan && existingLoan > 0) {
        return interaction.reply({ content: '{emoji:circlex} لديك قرض قائم بالفعل للبنك. قم بتسديد القرض الحالي لتتمكن من طلب قرض جديد.', ephemeral: true });
      }

      const loanAmount = 100000;
      userBalance += loanAmount;

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(`loan_${userId}`, loanAmount);
      await db.setKV(`loan_repay_${userId}`, Date.now() + 3600000);

      return interaction.reply({
        content: `🏦 تم منحك قرض بقيمة **$${loanAmount.toLocaleString()}** وتم إيداع المبلغ بحسابك.\nيجب عليك سداد القرض قبل انقضاء ساعة واحدة لتفادي الخصم التلقائي.`
      });
    }

    if (subcommand === 'payloan') {
      const outstandingLoan = await db.getKV(`loan_${userId}`);
      if (!outstandingLoan || outstandingLoan <= 0) {
        return interaction.reply({ content: '{emoji:circlex} ليس عليك أي قرض قائم حالياً لتسديده.', ephemeral: true });
      }

      if (userBalance < outstandingLoan) {
        return interaction.reply({ content: `{emoji:circlex} رصيدك الحالي لا يكفي لتسديد القرض. المطلوب: **$${outstandingLoan.toLocaleString()}**`, ephemeral: true });
      }

      userBalance -= outstandingLoan;
      await db.setKV(`balance_${userId}`, userBalance);
      await db.deleteKV(`loan_${userId}`);
      await db.deleteKV(`loan_repay_${userId}`);

      return interaction.reply({
        content: `🏦 تم تسديد القرض البنكي بقيمة **$${outstandingLoan.toLocaleString()}** بالكامل بنجاح.`
      });
    }

    if (subcommand === 'invest') {
      const amount = interaction.options.getInteger('amount');
      const cooldownKey = `cooldown_invest_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 14400000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار للاستثمار مرة أخرى. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      if (userBalance < amount) {
        return interaction.reply({ content: '{emoji:circlex} رصيدك الحالي لا يكفي للقيام بهذا الاستثمار.', ephemeral: true });
      }

      const isWin = Math.random() < 0.50;
      let diff = 0;

      if (isWin) {
        diff = Math.floor(amount * 0.10);
        userBalance += diff;
      } else {
        diff = Math.floor(amount * 0.10);
        userBalance -= diff;
      }

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(cooldownKey, now);

      return interaction.reply({
        content: isWin
          ? `📈 استثمار ناجح! لقد ربحت **$${diff.toLocaleString()}** من استثمارات البورصة اليوم.`
          : `📉 استثمار خاسر! فقدت **$${diff.toLocaleString()}** من استثمارات البورصة اليوم.`
      });
    }

    if (subcommand === 'trade') {
      const amount = interaction.options.getInteger('amount');
      const cooldownKey = `cooldown_trade_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 14400000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار للتداول مرة أخرى. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      if (userBalance < amount) {
        return interaction.reply({ content: '{emoji:circlex} رصيدك الحالي لا يكفي للتداول بهذا المبلغ.', ephemeral: true });
      }

      const isWin = Math.random() < 0.50;
      let diff = 0;

      if (isWin) {
        diff = Math.floor(amount * 0.15);
        userBalance += diff;
      } else {
        diff = Math.floor(amount * 0.15);
        userBalance -= diff;
      }

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(cooldownKey, now);

      return interaction.reply({
        content: isWin
          ? `📈 تداول ناجح! حققت ربح تداول بقيمة **$${diff.toLocaleString()}**.`
          : `📉 تداول خاسر! خسرت من التداولات بقيمة **$${diff.toLocaleString()}**.`
      });
    }

    if (subcommand === 'buy') {
      const type = interaction.options.getString('type');

      if (type === 'house') {
        const houseCost = 1000000;
        const userHouses = await db.getKV(`user_houses_${userId}`) || 0;

        if (userHouses >= 5) {
          return interaction.reply({ content: '{emoji:circlex} لقد بلغت الحد الأقصى لشراء المنازل (5 منازل).', ephemeral: true });
        }

        if (userBalance < houseCost) {
          return interaction.reply({ content: `{emoji:circlex} رصيدك المالي غير كافٍ لشراء منزل. السعر: **$${houseCost.toLocaleString()}**`, ephemeral: true });
        }

        userBalance -= houseCost;
        await db.setKV(`balance_${userId}`, userBalance);
        await db.setKV(`user_houses_${userId}`, userHouses + 1);

        return interaction.reply({
          content: `🏠 مبروك! لقد اشتريت منزلاً جديداً بنجاح.\nعدد منازلك الحالية: **${userHouses + 1}/5** (تمنحك المنازل دخلاً إضافياً مع كل راتب).`
        });
      }

      if (type === 'company') {
        const compId = interaction.options.getInteger('id');
        if (!compId) {
          return interaction.reply({ content: '{emoji:circlex} يجب تحديد رقم الشركة المطلوب شراءها (1-10).', ephemeral: true });
        }

        const comp = companiesData.find(c => c.id === compId);
        if (!comp) {
          return interaction.reply({ content: '{emoji:circlex} رقم الشركة غير صحيح.', ephemeral: true });
        }

        const owner = await db.getKV(`company_${compId}_owner`);
        if (owner) {
          return interaction.reply({ content: `{emoji:circlex} هذه الشركة مملوكة بالفعل لعضو آخر (<@${owner}>).`, ephemeral: true });
        }

        if (userBalance < comp.price) {
          return interaction.reply({ content: `{emoji:circlex} رصيدك غير كافٍ لشراء الشركة. السعر: **$${comp.price.toLocaleString()}**`, ephemeral: true });
        }

        userBalance -= comp.price;
        await db.setKV(`balance_${userId}`, userBalance);
        await db.setKV(`company_${compId}_owner`, userId);

        return interaction.reply({
          content: `🏢 مبروك! لقد اشتريت شركة **${comp.name}** بنجاح.\nستحصد أرباح هذه الشركة يومياً مع كشف الراتب.`
        });
      }
    }

    if (subcommand === 'companies') {
      const embed = new EmbedBuilder()
        .setTitle('🏢 دليل الشركات الاستثمارية')
        .setDescription('تمنحك الشركات دخلاً هائلاً ولكن بتكلفة شراء عالية!')
        .setColor(0x8C52FF);

      for (const comp of companiesData) {
        const owner = await db.getKV(`company_${comp.id}_owner`);
        const ownerMention = owner ? `<@${owner}>` : 'لا يوجد مالك';
        embed.addFields({
          name: `${comp.id}. ${comp.name}`,
          value: `💰 السعر: **$${comp.price.toLocaleString()}** | 📈 الدخل اليومي: **$${comp.rent.toLocaleString()}**\n👑 المالك الحالي: ${ownerMention}`
        });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'gamble') {
      const amount = interaction.options.getInteger('amount');
      const cooldownKey = `cooldown_gamble_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 14400000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار للمقامرة مرة أخرى. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      if (userBalance < amount) {
        return interaction.reply({ content: '{emoji:circlex} رصيدك الحالي لا يكفي للرهان.', ephemeral: true });
      }

      const isWin = Math.random() < 0.50;
      let diff = 0;

      if (isWin) {
        diff = Math.floor(amount * 1.5);
        userBalance += diff;
      } else {
        diff = amount;
        userBalance -= diff;
      }

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(cooldownKey, now);

      return interaction.reply({
        content: isWin
          ? `🎉 مبروك! فزت بالمقامرة وربحت **$${diff.toLocaleString()}**.\nرصيدك الحالي هو **$${userBalance.toLocaleString()}**.`
          : `💀 للأسف! خسرت المقامرة وفقدت مبلغ الرهان بالكامل **$${diff.toLocaleString()}**.\nرصيدك الحالي هو **$${userBalance.toLocaleString()}**.`
      });
    }

    if (subcommand === 'dice') {
      const amount = interaction.options.getInteger('amount');
      const cooldownKey = `cooldown_dice_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 14400000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار مجدداً للعب النرد. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      if (userBalance < amount) {
        return interaction.reply({ content: '{emoji:circlex} رصيدك الحالي لا يكفي للعب النرد.', ephemeral: true });
      }

      const roll = Math.floor(Math.random() * 6) + 1;
      const isWin = roll >= 4;
      let diff = 0;

      if (isWin) {
        diff = Math.floor(amount * 1.2);
        userBalance += diff;
      } else {
        diff = amount;
        userBalance -= diff;
      }

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(cooldownKey, now);

      return interaction.reply({
        content: `🎲 رميت النرد وحصلت على الرقم **${roll}**!\n\n${isWin ? `🎉 فزت! ربحت **$${diff.toLocaleString()}**.` : `💀 خسرت! فقدت **$${diff.toLocaleString()}**.`}\nرصيدك الحالي هو **$${userBalance.toLocaleString()}**.`
      });
    }

    if (subcommand === 'coinflip') {
      const amount = interaction.options.getInteger('amount');
      const cooldownKey = `cooldown_coin_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 7200000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار لرمي العملة مرة أخرى. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      if (userBalance < amount) {
        return interaction.reply({ content: '{emoji:circlex} رصيدك الحالي لا يكفي لرمي العملة.', ephemeral: true });
      }

      const side = Math.random() < 0.50 ? 'وجه' : 'كتابة';
      const isWin = Math.random() < 0.50;
      let diff = 0;

      if (isWin) {
        diff = amount;
        userBalance += diff;
      } else {
        diff = amount;
        userBalance -= diff;
      }

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(cooldownKey, now);

      return interaction.reply({
        content: `🪙 رميت العملة المعدنية واستقرت على الـ **${side}**!\n\n${isWin ? `🎉 فزت! ربحت **$${diff.toLocaleString()}**.` : `💀 خسرت! فقدت **$${diff.toLocaleString()}**.`}\nرصيدك الحالي هو **$${userBalance.toLocaleString()}**.`
      });
    }

    if (subcommand === 'rob') {
      const targetUser = interaction.options.getUser('user');
      const cooldownKey = `cooldown_rob_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 14400000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        const remaining = cooldownTime - (now - lastUsed);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `{emoji:clock} يرجى الانتظار للنهب مرة أخرى. الوقت المتبقي: **${hours} ساعة و ${minutes} دقيقة**`, ephemeral: true });
      }

      if (targetUser.bot || targetUser.id === userId) {
        return interaction.reply({ content: '{emoji:circlex} لا يمكنك سرقة نفسك أو سرقة بوت.', ephemeral: true });
      }

      const targetShield = await db.getKV(`shield_${targetUser.id}`);
      if (targetShield && now < targetShield) {
        return interaction.reply({ content: '{emoji:circlex} لا يمكنك سرقة هذا اللاعب لأنه يملك درع حماية نشط لحساب الحظر من البنك!', ephemeral: true });
      }

      const targetBalance = await db.getKV(`balance_${targetUser.id}`) || 0;
      if (targetBalance < 1000) {
        return interaction.reply({ content: '{emoji:circlex} رصيد الشخص المستهدف ضئيل جداً ولا يستحق المحاولة.', ephemeral: true });
      }

      const isSuccess = Math.random() < 0.50;

      if (isSuccess) {
        const percent = (Math.floor(Math.random() * 20) + 10) / 100;
        const stolen = Math.floor(targetBalance * percent);
        userBalance += stolen;
        const newTargetBalance = targetBalance - stolen;

        await db.setKV(`balance_${userId}`, userBalance);
        await db.setKV(`balance_${targetUser.id}`, newTargetBalance);
        await db.setKV(cooldownKey, now);

        return interaction.reply({
          content: `💰 نجحت محاولة السرقة! لقد نهبت **$${stolen.toLocaleString()}** من حساب <@${targetUser.id}>.`
        });
      } else {
        const fine = Math.min(5000, Math.floor(userBalance * 0.10));
        userBalance = Math.max(0, userBalance - fine);

        await db.setKV(`balance_${userId}`, userBalance);
        await db.setKV(cooldownKey, now);

        return interaction.reply({
          content: `🚨 تم القبض عليك أثناء محاولة السرقة! وقامت الشرطة بفرض غرامة عليك بقيمة **$${fine.toLocaleString()}**.`
        });
      }
    }

    if (subcommand === 'protect') {
      const hours = interaction.options.getInteger('hours');
      const cost = hours * 500000;

      if (userBalance < cost) {
        return interaction.reply({ content: `{emoji:circlex} رصيدك غير كافٍ لشراء الحماية. التكلفة: **$${cost.toLocaleString()}**`, ephemeral: true });
      }

      userBalance -= cost;
      const expireTime = Date.now() + (hours * 3600000);

      await db.setKV(`balance_${userId}`, userBalance);
      await db.setKV(`shield_${userId}`, expireTime);

      return interaction.reply({
        content: `{emoji:shield} تم تفعيل درع الحماية بنجاح لمدة **${hours} ساعة** لحماية رصيدك المالي من السرقة والنهب.`
      });
    }

    if (subcommand === 'top') {
      const cooldownKey = `cooldown_top_${userId}`;
      const lastUsed = await db.getKV(cooldownKey);
      const now = Date.now();
      const cooldownTime = 30000;

      if (lastUsed && (now - lastUsed) < cooldownTime) {
        return interaction.reply({ content: '{emoji:clock} يرجى الانتظار 30 ثانية لتحديث قائمة الأثرياء.', ephemeral: true });
      }

      const topUsers = await db.getTopBalances(6);
      if (topUsers.length === 0) {
        return interaction.reply({ content: 'لا يوجد أعضاء لديهم رصيد بنكي في السيرفر حالياً.' });
      }

      const embed = new EmbedBuilder()
        .setTitle('{emoji:trophy} قائمة أغنى الأعضاء في السيرفر')
        .setDescription('ترتيب أثرياء السيرفر وفقاً للرصيد البنكي:')
        .setColor(0xFFD700)
        .setTimestamp();

      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        embed.addFields({ name: `${medal} المركز ${index + 1}`, value: `<@${user.userId}> - **$${user.balance.toLocaleString()}**` });
      });

      await db.setKV(cooldownKey, now);

      return interaction.reply({ embeds: [embed] });
    }
  }
};
