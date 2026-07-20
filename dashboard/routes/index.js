const express = require('express');
const router = express.Router();

module.exports = (client) => {
    router.get('/', (req, res) => {
        const uptimeSeconds = process.uptime();
        const days    = Math.floor(uptimeSeconds / 86400);
        const hours   = Math.floor(uptimeSeconds / 3600) % 24;
        const minutes = Math.floor(uptimeSeconds / 60) % 60;
        const uptimeString = days > 0
            ? `${days}d ${hours}h ${minutes}m`
            : `${hours}h ${minutes}m`;

        const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

        res.render('index', {
            bot: client.user,
            stats: {
                totalGuilds: client.guilds.cache.size,
                totalUsers:  client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
                uptime:      uptimeString,
                ram:         `${memMB} MB`,
                ping:        `${client.ws.ping} ms`
            }
        });
    });

    return router;
};
