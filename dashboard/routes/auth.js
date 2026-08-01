const express = require('express');
const passport = require('passport');
const logger = require('../../utils/logger');
const router = express.Router();

router.get('/login', passport.authenticate('discord'));

router.get('/callback', (req, res, next) => {
  passport.authenticate('discord', (err, user) => {
    if (err) {
      logger.error('[Dashboard Auth Error]:', err);
      return res.redirect('/?error=auth_failed');
    }
    if (!user) {
      return res.redirect('/?error=no_user');
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        logger.error('[Dashboard Login Error]:', loginErr);
        return res.redirect('/?error=login_failed');
      }
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
