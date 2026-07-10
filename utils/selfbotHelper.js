



function getCalendarMonthsDifference(startDate, endDate) {
  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  if (endDate.getDate() < startDate.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

function getMilestoneDate(startDate, monthsOffset) {
  const target = new Date(startDate.getTime());
  const originalDay = startDate.getDate();
  target.setMonth(target.getMonth() + monthsOffset);
  if (target.getDate() !== originalDay) {
    target.setDate(0);
  }
  return target;
}



const CHROME_VERSION = '149.0.0.0';
const USER_AGENT =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;


let _cachedBuildNumber = 554905;
let buildNumberPromise = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));




async function fetchDiscordBuildNumber() {
  try {
    const pageRes = await fetch('https://discord.com/login', {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    if (!pageRes.ok) throw new Error(`Login page returned ${pageRes.status}`);
    const html = await pageRes.text();

    const scriptMatches = [...html.matchAll(/src="(\/assets\/[a-zA-Z0-9.]+\.js)"/g)];
    const scriptUrls = scriptMatches.map((m) => `https://discord.com${m[1]}`).slice(-10);

    for (const url of scriptUrls.reverse()) {
      try {
        const jsRes = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
        if (!jsRes.ok) continue;
        const js = await jsRes.text();

        const match =
          js.match(/["\s]buildNumber[=:]["']?(\d{5,6})/) ||
          js.match(/"buildNumber","(\d{5,6})"/) ||
          js.match(/build_number[=:]["']?(\d{5,6})/);

        if (match) {
          const num = parseInt(match[1], 10);
          console.log(`[SelfbotHelper] Discord build number: ${num}`);
          return num;
        }
      } catch (_) {  }
    }
    console.warn('[SelfbotHelper] Could not find build number — using fallback.');
  } catch (err) {
    console.warn('[SelfbotHelper] Build number fetch failed:', err.message);
  }
  return _cachedBuildNumber;
}

function getBuildNumber() {
  if (buildNumberPromise) return buildNumberPromise;
  buildNumberPromise = fetchDiscordBuildNumber().then((num) => {
    _cachedBuildNumber = num;
    return num;
  });
  return buildNumberPromise;
}


getBuildNumber();



function buildSuperProperties() {
  return Buffer.from(
    JSON.stringify({
      os: 'Windows',
      browser: 'Chrome',
      device: '',
      system_locale: 'en-US',
      browser_user_agent: USER_AGENT,
      browser_version: CHROME_VERSION,
      os_version: '10',
      referrer: '',
      referring_domain: '',
      referrer_current: '',
      referring_domain_current: '',
      release_channel: 'stable',
      client_build_number: _cachedBuildNumber,
      client_event_source: null,
    })
  ).toString('base64');
}

function getHeaders(token, fingerprint = null) {
  const sanitizedToken = token.trim().replace(/^Bot\s+/i, '');
  const headers = {
    Authorization: sanitizedToken,
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    'X-Super-Properties': buildSuperProperties(),
    'X-Discord-Locale': 'en-US',
    'X-Discord-Timezone': 'America/New_York',
    'X-Debug-Options': 'bugReporterEnabled',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://discord.com',
    Referer: 'https://discord.com/channels/@me',
    'Sec-Ch-Ua': `"Google Chrome";v="149", "Chromium";v="149", "Not.A/Brand";v="24"`,
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
  if (fingerprint) headers['X-Fingerprint'] = fingerprint;
  return headers;
}

async function getFingerprint() {
  try {
    const res = await fetch('https://discord.com/api/v9/experiments', {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://discord.com',
        Referer: 'https://discord.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.fingerprint ?? null;
  } catch {
    return null;
  }
}




async function solveCaptcha(sitekey, rqdata, rqtoken) {
  const apiKey = process.env.CAPTCHA_API_KEY;
  const baseUrl = (process.env.CAPTCHA_SERVICE_URL || 'https://2captcha.com').replace(/\/$/, '');

  const isDefaultKey = [
    'YOUR_2CAPTCHA_OR_CAPMONSTER_KEY_HERE',
    'YOUR_NOPECHA_KEY_HERE',
    'YOUR_NOPECHA_OR_2CAPTCHA_KEY_HERE',
    'none',
    ''
  ].includes(apiKey?.trim() || '');

  if (!apiKey || isDefaultKey) {
    throw new Error(
      'CAPTCHA triggered! To run 100% free without keys, simply wait 15–30 minutes for your Discord rate-limit to reset and try again (avoid changing profiles too fast).\n' +
      'To solve automatically, sign up at https://nopecha.com (free 100 solves/day) and add CAPTCHA_API_KEY to your .env file.'
    );
  }

  const isNopecha = baseUrl.includes('nopecha.com');
  console.log(`[SelfbotHelper] Submitting captcha to ${baseUrl} (Nopecha solver: ${isNopecha})...`);

  if (isNopecha) {
    const submitRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: apiKey,
        type: 'hcaptcha',
        sitekey,
        url: 'https://discord.com',
        data: {
          rqdata,
        },
      }),
    });

    if (!submitRes.ok) throw new Error(`NopeCHA submit HTTP error: ${submitRes.status}`);
    const submitData = await submitRes.json();

    if (submitData.error) {
      throw new Error(`NopeCHA task creation failed: (${submitData.error}) ${submitData.message}`);
    }

    const taskId = submitData.data;
    console.log(`[SelfbotHelper] NopeCHA task submitted (ID: ${taskId}). Waiting for solution...`);

    
    for (let i = 0; i < 24; i++) {
      await sleep(5000);

      const pollRes = await fetch(`${baseUrl}/token?key=${apiKey}&id=${taskId}`);
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();

      if (pollData.data && !pollData.error) {
        console.log('[SelfbotHelper] Captcha solved ✅');
        return { captchaKey: pollData.data, captchaRqtoken: rqtoken };
      }

      if (pollData.error && pollData.error !== 14) { 
        throw new Error(`NopeCHA solve failed: (${pollData.error}) ${pollData.message}`);
      }

      console.log(`[SelfbotHelper] Captcha pending... (attempt ${i + 1}/24)`);
    }
    throw new Error('NopeCHA solving timed out after 2 minutes.');
  } else {
    
    const submitRes = await fetch(`${baseUrl}/in.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: apiKey,
        method: 'hcaptcha',
        sitekey,
        pageurl: 'https://discord.com',
        data: rqdata,          
        userAgent: USER_AGENT,
        json: 1,
      }),
    });

    if (!submitRes.ok) throw new Error(`Captcha submit HTTP error: ${submitRes.status}`);
    const submitData = await submitRes.json();

    if (submitData.status !== 1) {
      throw new Error(`Captcha submit rejected: ${submitData.request}`);
    }

    const taskId = submitData.request;
    console.log(`[SelfbotHelper] Captcha task submitted (ID: ${taskId}). Waiting for solution...`);

    
    for (let i = 0; i < 24; i++) {
      await sleep(5000);

      const pollRes = await fetch(
        `${baseUrl}/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`
      );
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();

      if (pollData.status === 1) {
        console.log('[SelfbotHelper] Captcha solved ✅');
        return { captchaKey: pollData.request, captchaRqtoken: rqtoken };
      }

      if (pollData.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`Captcha solve failed: ${pollData.request}`);
      }

      console.log(`[SelfbotHelper] Captcha pending... (attempt ${i + 1}/24)`);
    }

    throw new Error('Captcha solving timed out after 2 minutes.');
  }
}




async function validateToken(token) {
  try {
    await getBuildNumber();
    const response = await fetch('https://discord.com/api/v9/users/@me', {
      method: 'GET',
      headers: getHeaders(token),
    });

    if (response.status === 200) {
      return { success: true, user: await response.json() };
    } else if (response.status === 401) {
      return { success: false, error: 'Unauthorized: The token is invalid or expired.' };
    } else {
      const errBody = await response.text();
      return { success: false, error: `Discord API returned status ${response.status}: ${errBody}` };
    }
  } catch (error) {
    return { success: false, error: `Failed to connect to Discord API: ${error.message}` };
  }
}


async function imageUrlToBase64DataUri(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: status ${response.status}`);

    let contentType = (response.headers.get('content-type') || 'image/png')
      .split(';')[0].trim().toLowerCase();

    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(contentType)) contentType = 'image/png';

    const base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('[SelfbotHelper] Image download failed:', error.message);
    throw new Error(`Failed to process image from URL: ${error.message}`);
  }
}



async function getUserNitroInfo(token, targetUserId = null) {
  try {
    await getBuildNumber();
    const res = await fetch('https://discord.com/api/v9/users/@me', {
      headers: getHeaders(token),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Discord API returned ${res.status}: ${errText}` };
    }

    const user = await res.json();
    const targetId = targetUserId || user.id;
    
    
    const profileRes = await fetch(`https://discord.com/api/v9/users/${targetId}/profile`, {
      headers: getHeaders(token),
    });

    if (!profileRes.ok) {
      return { success: false, error: `Failed to fetch profile: ${profileRes.status}` };
    }

    const profileData = await profileRes.json();
    const premiumSince = profileData.premium_since ?? null;
    let premiumType = 0;
    if (profileData.premium_type !== undefined && profileData.premium_type !== null) {
      premiumType = profileData.premium_type;
    } else if (profileData.user?.premium_type !== undefined && profileData.user?.premium_type !== null) {
      premiumType = profileData.user.premium_type;
    }
    
    if (premiumSince && premiumType === 0) {
      premiumType = 2;
    }

    if (premiumType === 0 || !premiumSince) {
      return { success: true, data: { hasNitro: false, premiumType: 0 } };
    }

    const sinceDate = new Date(premiumSince);
    const now = new Date();
    const totalDays = Math.floor((now - sinceDate) / (1000 * 60 * 60 * 24));
    const totalMonths = getCalendarMonthsDifference(sinceDate, now);

    
    
    const TIER_THRESHOLDS = [
      { name: 'opal',     months: 72, badge: 'opal' },
      { name: 'ruby',     months: 60, badge: 'ruby' },
      { name: 'emerald',  months: 36, badge: 'emerald' },
      { name: 'diamond',  months: 24, badge: 'diamond' },
      { name: 'platinum', months: 12, badge: 'platinum' },
      { name: 'gold',     months: 6,  badge: 'gold' },
      { name: 'silver',   months: 3,  badge: 'silver' },
      { name: 'bronze',   months: 1,  badge: 'bronze' },
    ];

    let currentTierName = 'none';
    let currentBadge = 'none';
    let nextTierName = 'bronze';
    let progressStart = 0;
    let progressEnd = 1;
    let progressPercent = Math.min((totalMonths / 1) * 100, 100);
    let nextMonths = 1;

    const matchedTier = TIER_THRESHOLDS.find(t => totalMonths >= t.months);
    if (matchedTier) {
      currentTierName = matchedTier.name;
      currentBadge = matchedTier.badge;
      const tierIndex = TIER_THRESHOLDS.findIndex(t => t.name === matchedTier.name);
      const nextTier = tierIndex > 0 ? TIER_THRESHOLDS[tierIndex - 1] : null;
      if (nextTier) {
        nextTierName = nextTier.name;
        progressStart = matchedTier.months;
        progressEnd = nextTier.months;
        progressPercent = Math.min(((totalMonths - progressStart) / (progressEnd - progressStart)) * 100, 100);
        nextMonths = nextTier.months;
      } else {
        nextTierName = null;
        progressStart = matchedTier.months;
        progressEnd = matchedTier.months + 60;
        progressPercent = 100;
        nextMonths = null;
      }
    }

    let timeRemainingMs = null;
    let daysRemaining = null;
    if (nextMonths != null) {
      const targetDate = getMilestoneDate(sinceDate, nextMonths);
      const msDiff = targetDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
      timeRemainingMs = msDiff;
    }

    
    const earnedTiers = TIER_THRESHOLDS.filter(t => totalMonths >= t.months).reverse();
    const currentBadgeEarnedDate = getMilestoneDate(sinceDate, progressStart);

    return {
      success: true,
      data: {
        hasNitro: true,
        premiumType,
        premiumSince,
        totalMonths,
        totalDays,
        daysRemaining,
        timeRemainingMs,
        currentTier: currentTierName,
        currentBadge,
        currentBadgeEarnedDate,
        nextTier: nextTierName,
        progressPercent,
        progressStart,
        progressEnd,
        earnedTiers,
        username: profileData?.user?.username || user.username,
        discriminator: profileData?.user?.discriminator || user.discriminator,
        avatarHash: profileData?.user?.avatar || user.avatar,
        userId: targetId,
      }
    };
  } catch (err) {
    return { success: false, error: `Connection error: ${err.message}` };
  }
}


async function getUserBoostInfo(token, targetUserId = null) {
  try {
    await getBuildNumber();

    let targetId = targetUserId;
    if (!targetId) {
      const userRes = await fetch('https://discord.com/api/v9/users/@me', {
        headers: getHeaders(token),
      });
      if (userRes.ok) {
        const user = await userRes.json();
        targetId = user.id;
      } else {
        return { success: false, error: 'Could not fetch own user id' };
      }
    }

    const profileRes = await fetch(`https://discord.com/api/v9/users/${targetId}/profile?with_mutual_guilds=false`, {
      headers: getHeaders(token),
    });

    if (!profileRes.ok) {
      return { success: false, error: `Failed to fetch profile: ${profileRes.status}` };
    }

    const profileData = await profileRes.json();
    const premiumGuildSince = profileData.premium_guild_since ?? null;

    if (!premiumGuildSince) {
      return { success: true, data: { hasBoost: false, totalBoosts: 0, boostMonths: 0, badgeTier: 0, oldestBoostDate: null } };
    }

    const oldestBoostDate = new Date(premiumGuildSince);
    const now = new Date();
    const boostMonths = getCalendarMonthsDifference(oldestBoostDate, now);
    const totalBoosts = 1; 

    const MONTH_TIERS = [24, 18, 15, 12, 9, 6, 3, 2, 1];
    let badgeTier = 1;
    let nextTierMonths = 1;
    let currentTierMonths = 0;

    for (let i = 0; i < MONTH_TIERS.length; i++) {
      if (boostMonths >= MONTH_TIERS[i]) {
        badgeTier = 9 - i;
        currentTierMonths = MONTH_TIERS[i];
        if (i > 0) {
          nextTierMonths = MONTH_TIERS[i - 1];
        } else {
          nextTierMonths = null;
        }
        break;
      }
    }
    if (boostMonths < 1) {
      badgeTier = 1;
      nextTierMonths = 2; 
      
      
      
    }

    let timeRemainingMs = null;
    let daysRemaining = null;
    if (nextTierMonths != null) {
      const targetDate = getMilestoneDate(oldestBoostDate, nextTierMonths);
      const msDiff = targetDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
      timeRemainingMs = Math.max(0, msDiff);
    }

    const progressPercent = Math.min((boostMonths / 24) * 100, 100);
    const currentBadgeEarnedDate = getMilestoneDate(oldestBoostDate, currentTierMonths);

    return {
      success: true,
      data: {
        hasBoost: totalBoosts > 0,
        totalBoosts,
        boostMonths,
        badgeTier,
        progressPercent,
        oldestBoostDate,
        timeRemainingMs,
        daysRemaining,
        currentBadgeEarnedDate,
        boostEntries: [],
        username: profileData.user?.username || 'Unknown',
        discriminator: profileData.user?.discriminator || '0',
        avatarHash: profileData.user?.avatar || null,
        userId: targetId,
      }
    };
  } catch (err) {
    return { success: false, error: `Connection error: ${err.message}` };
  }
}

async function updateProfile(token, { avatarUrl, bannerUrl }) {
  try {
    
    const validateRes = await validateToken(token);
    if (!validateRes.success) {
      return { success: false, error: `Invalid Token: ${validateRes.error}` };
    }
    const hasNitroBoost = (validateRes.user.premium_type ?? 0) === 2;

    let appliedAvatar = false;
    let appliedBanner = false;
    const warnings = [];

    
    const fingerprint = await getFingerprint();
    console.log(fingerprint
      ? '[SelfbotHelper] Fingerprint acquired.'
      : '[SelfbotHelper] No fingerprint — proceeding without it.'
    );

    
    async function patch(payload, attempt = 1) {
      const res = await fetch('https://discord.com/api/v9/users/@me', {
        method: 'PATCH',
        headers: getHeaders(token, fingerprint),
        body: JSON.stringify(payload),
      });

      if (res.ok) return { ok: true };

      const text = await res.text();
      console.error(`[SelfbotHelper] PATCH failed (${res.status}):`, text);

      let message = `Status ${res.status}`;
      let isRateLimit = false;
      let captchaData = null;

      try {
        const json = JSON.parse(text);

        
        if (json.captcha_key) {
          captchaData = {
            sitekey: json.captcha_sitekey,
            rqdata: json.captcha_rqdata,
            rqtoken: json.captcha_rqtoken,
          };
          message = 'hCaptcha challenge';
        }

        if (json.message) message = json.message;

        
        const bannerErrors = json.errors?.banner?._errors ?? [];
        if (bannerErrors.some((e) => e.code === 'BANNER_RATE_LIMIT')) {
          isRateLimit = true;
          message = 'Banner rate limited';
        }

        if (res.status === 429) {
          isRateLimit = true;
          if (json.retry_after) message += ` (retry after ${json.retry_after}s)`;
        }

        if (json.errors && !isRateLimit && !captchaData) {
          message += ` — ${JSON.stringify(json.errors)}`;
        }
      } catch (_) {
        message += `: ${text}`;
      }

      
      if (captchaData && attempt === 1) {
        try {
          const { captchaKey, captchaRqtoken } = await solveCaptcha(
            captchaData.sitekey,
            captchaData.rqdata,
            captchaData.rqtoken
          );
          
          return patch(
            { ...payload, captcha_key: captchaKey, captcha_rqtoken: captchaRqtoken },
            2
          );
        } catch (solveErr) {
          return { ok: false, message: solveErr.message, isRateLimit: false, isCaptcha: true };
        }
      }

      return { ok: false, message, isRateLimit, isCaptcha: !!captchaData };
    }
    

    
    if (avatarUrl) {
      let avatarData;
      try {
        avatarData = await imageUrlToBase64DataUri(avatarUrl);
      } catch (err) {
        return { success: false, error: `Avatar processing failed: ${err.message}` };
      }

      const result = await patch({ avatar: avatarData });
      if (result.ok) {
        appliedAvatar = true;
      } else {
        return {
          success: false,
          error: `Avatar update failed: ${result.message}`,
          appliedAvatar: false,
          appliedBanner: false,
        };
      }
    }

    
    if (bannerUrl) {
      if (!hasNitroBoost) {
        warnings.push('Nitro Boost is required for custom banners — banner skipped.');
      } else {
        if (avatarUrl) await sleep(3000);

        let bannerData;
        try {
          bannerData = await imageUrlToBase64DataUri(bannerUrl);
        } catch (err) {
          warnings.push(`Banner processing failed: ${err.message} — skipped.`);
          bannerData = null;
        }

        if (bannerData) {
          const result = await patch({ banner: bannerData });
          if (result.ok) {
            appliedBanner = true;
          } else if (result.isRateLimit) {
            warnings.push(
              'Banner is rate-limited — wait a few minutes then try again. Your avatar was applied successfully.'
            );
          } else if (result.isCaptcha) {
            warnings.push(
              'Captcha solver failed for banner — add CAPTCHA_API_KEY to your .env. Avatar was applied successfully.'
            );
          } else {
            warnings.push(`Banner update failed: ${result.message}`);
          }
        }
      }
    }

    if (!avatarUrl && !bannerUrl) {
      return { success: true, appliedAvatar: false, appliedBanner: false, warning: 'No modifications were requested.' };
    }

    return {
      success: true,
      appliedAvatar,
      appliedBanner,
      warning: warnings.length ? warnings.join('\n') : null,
    };
  } catch (error) {
    return {
      success: false,
      error: `Network/connection error: ${error.message}`,
      appliedAvatar: false,
      appliedBanner: false,
    };
  }
}


module.exports = { validateToken, imageUrlToBase64DataUri, getUserNitroInfo, getUserBoostInfo, updateProfile };