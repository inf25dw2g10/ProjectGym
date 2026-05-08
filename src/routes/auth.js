
const express = require('express');
const passport = require('passport');
const router = express.Router();

const ctrl = require('../controllers/authController');
const { basicAuthLoginMiddleware } = require('../middleware/auth');
const { Utilizador } = require('../../models');

router.get('/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/')
);

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/')
);

router.post('/register', ctrl.register);
router.post('/login',
  // Permite "login por API key" no Swagger sem body.
  async (req, res, next) => {
    const apiKey = req.get('x-api-key');
    if (!apiKey) return next();
    try {
      const user = await Utilizador.findOne({ where: { apiKey } });
      if (!user) return res.status(401).json({ erro: 'API Key inválida.' });

      req.logIn(user, (err) => {
        if (err) return next(err);
        console.log('\n┌─────────────────────────────────────────────');
        console.log('│ API Key Login');
        console.log(`│  ID       : ${user.id}`);
        console.log(`│  Username : ${user.username}`);
        console.log(`│  Email    : ${user.email || '(não disponível)'}`);
        console.log(`│  Role     : ${user.role}`);
        console.log('└─────────────────────────────────────────────\n');
        return res.status(200).json({
          mensagem: 'Login efetuado com sucesso.',
          id: user.id,
          role: user.role,
          apiKey: user.apiKey
        });
      });
    } catch (err) {
      return next(err);
    }
  },
  // Normaliza body quando credenciais vêm em Authorization: Basic.
  basicAuthLoginMiddleware,
  ctrl.login
); // aceita JSON ou Authorization: Basic ...
router.get('/logout', ctrl.logout);

module.exports = router;
