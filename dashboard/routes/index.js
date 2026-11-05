const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../../database/db');
const router = express.Router();

module.exports = (client) => {
  router.get('/', (req, res) => {
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor(uptimeSeconds / 3600) % 24;
    const minutes = Math.floor(uptimeSeconds / 60) % 60;
    const uptimeString = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;

    const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const ping = client?.ws?.ping !== undefined && client?.ws?.ping >= 0 ? `${client.ws.ping} ms` : '0 ms';
    const totalGuilds = client?.guilds?.cache?.size || 0;
    const totalUsers = client?.guilds?.cache ? client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0) : 0;

    res.render('index', {
      bot: client?.user || { username: 'E-246', displayAvatarURL: () => '/img/logo.png' },
      stats: {
        totalGuilds,
        totalUsers,
        uptime: uptimeString,
        ram: `${memMB} MB`,
        ping
      }
    });
  });

  router.get('/transcripts/:ticketId', async (req, res) => {
    try {
      const ticketId = req.params.ticketId.replace(/[^0-9a-zA-Z_-]/g, '');
      const htmlFromDb = await db.getWebTranscript(ticketId);
      if (htmlFromDb) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlFromDb);
      }

      const filePath = path.join(__dirname, '..', 'public', 'transcripts', `${ticketId}.html`);
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }

      return res
        .status(404)
        .send(
          '<div style="text-align:center;padding:50px;font-family:sans-serif;"><h2>تفريغ التذكرة غير موجود أو تم حذفه</h2><p>Ticket transcript not found.</p></div>'
        );
    } catch (err) {
      return res
        .status(500)
        .send(
          '<div style="text-align:center;padding:50px;font-family:sans-serif;"><h2>حدث خطأ أثناء تحميل تفريغ التذكرة</h2></div>'
        );
    }
  });

  return router;
};
