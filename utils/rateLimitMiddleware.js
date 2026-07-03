const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');

let redisClient = null;

if (process.env.REDIS_HOST) {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('Redis connection failed after 10 attempts; continuing without Redis rate-limit store');
          return null;
        }
        return Math.min(times * 100, 3000);
      }
    });

    redisClient.on('error', (err) => console.error('Redis connection error:', err.message));
    redisClient.on('connect', () => console.log('Redis connected successfully'));
  } catch (err) {
    redisClient = null;
    console.warn('Redis not available, using memory store:', err.message);
  }
}

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'تم تجاوز الحد المسموح للطلبات. يرجى المحاولة مرة أخرى لاحقاً.'
  },
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rate_limit_api:'
    })
  })
});

const dashboardLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'تم تجاوز الحد المسموح للطلبات للوحة التحكم. يرجى المحاولة مرة أخرى لاحقاً.'
  },
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rate_limit_dashboard:'
    })
  })
});

const webhookLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'تم تجاوز الحد المسموح للطلبات. يرجى الانتظار قبل إرسال طلبات أخرى.'
  },
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rate_limit_webhook:'
    })
  })
});

module.exports = {
  generalLimiter,
  dashboardLimiter,
  webhookLimiter,
  redisClient
};
