const express = require('express');
const router = express.Router();

module.exports = (client) => {
    router.get('/', (req, res) => {
        res.render('index', {
            bot: client.user,
            stats: {
                guilds: client.guilds.cache.size,
                users: client.users.cache.size
            }
        });
    });

    return router;
};
