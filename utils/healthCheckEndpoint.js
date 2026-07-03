const { EmbedBuilder } = require('discord.js');


const healthCheckEndpoint = (client) => async (req, res) => {
  try {
    const { version } = require('../package.json');
    const os = require('os');

    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const uptime = process.uptime();

    const memoryUsage = process.memoryUsage();
    const memUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    const memTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100;

    const cpuUsage = process.cpuUsage();
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / process.uptime() * 100).toFixed(2);

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime),
        human: formatUptime(uptime)
      },
      server: {
        name: os.hostname(),
        platform: os.platform(),
        arch: os.arch()
      },
      discord: {
        guilds: guilds,
        users: users,
        uptime: Math.floor(uptime)
      },
      resources: {
        memory: {
          used: `${memUsed} MB`,
          total: `${memTotal} MB`,
          usage: `${(memUsed / memTotal * 100).toFixed(2)}%`
        },
        cpu: {
          usage: `${cpuPercent}%`
        }
      },
      application: {
        name: 'e',
        version: version
      }
    };

    res.json(healthData);

  } catch (error) {
    const errorData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    res.status(500).json(errorData);
  }
};

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} ثانية`);

  return parts.join(', ');
}

module.exports = healthCheckEndpoint;
