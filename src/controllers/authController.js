
const passport  = require('passport');
const crypto    = require('crypto');
const { Utilizador } = require('../../models');
const bcrypt = require('bcryptjs');

function gerarApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Guarda só o id na sessão para manter cookie leve.
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    // Reconstroi o user completo a partir do id da sessão.
    const user = await Utilizador.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

const { Strategy: GitHubStrategy } = require('passport-github2');

const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID     || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL  = process.env.GITHUB_CALLBACK_URL  || 'http://localhost:3000/auth/github/callback';

passport.use(
  new GitHubStrategy(
    {
      clientID:     GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL:  GITHUB_CALLBACK_URL,
      scope:        ['user:email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Se já existe providerId, atualiza perfil; senão cria conta cliente.
        const email     = profile.emails?.[0]?.value ?? null;
        const avatarUrl = profile.photos?.[0]?.value ?? null;
        const providerId = String(profile.id);

        let user = await Utilizador.findOne({ where: { providerId } });

        if (user) {
          await user.update({
            username:    profile.username,
            displayName: profile.displayName || null,
            email,
            avatarUrl,
            provider: 'github'
          });
        } else {
          user = await Utilizador.create({
            providerId,
            provider:    'github',
            username:    profile.username,
            displayName: profile.displayName || null,
            email,
            avatarUrl,
            apiKey: gerarApiKey(),
            role:   'cliente'
          });
        }

        console.log('\n┌─────────────────────────────────────────────');
        console.log(`│ OAuth 2 Login`);
        console.log(`│  Provider : ${user.provider}`);
        console.log(`│  Username : ${user.username}`);
        console.log('└─────────────────────────────────────────────\n');

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL  || 'http://localhost:3000/auth/google/callback';

passport.use(
  new GoogleStrategy(
    {
      clientID:     GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL:  GOOGLE_CALLBACK_URL,
      scope:        ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email     = profile.emails?.[0]?.value ?? null;
        const avatarUrl = profile.photos?.[0]?.value ?? null;
        const providerId = `google_${profile.id}`;

        let user = await Utilizador.findOne({ where: { providerId } });

        if (user) {
          await user.update({
            username:    profile.displayName?.replace(/\s+/g, '_').toLowerCase() || `google_${profile.id}`,
            displayName: profile.displayName || null,
            email,
            avatarUrl,
            provider: 'google'
          });
        } else {
          user = await Utilizador.create({
            providerId,
            provider:    'google',
            username:    profile.displayName?.replace(/\s+/g, '_').toLowerCase() || `google_${profile.id}`,
            displayName: profile.displayName || null,
            email,
            avatarUrl,
            apiKey: gerarApiKey(),
            role:   'cliente'
          });
        }

        console.log('\n┌─────────────────────────────────────────────');
        console.log(`│ OAuth 2 Login`);
        console.log(`│  Provider : ${user.provider}`);
        console.log(`│  Username : ${user.username}`);
        console.log('└─────────────────────────────────────────────\n');

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

const { Strategy: LocalStrategy } = require('passport-local');

passport.use(
  new LocalStrategy(
    { usernameField: 'usernameOrEmail', passwordField: 'password' },
    async (usernameOrEmail, password, done) => {
      try {
        const { Op } = require('sequelize');
        const user = await Utilizador.findOne({
          where: {
            provider: 'basic',
            [Op.or]: [
              { email: usernameOrEmail },
              { username: usernameOrEmail }
            ]
          }
        });
        if (!user) return done(null, false, { message: 'Credenciais inválidas.' });

        const valida = await bcrypt.compare(password, user.passwordHash);
        if (!valida) return done(null, false, { message: 'Email ou password incorretos.' });

        console.log('\n┌─────────────────────────────────────────────');
        console.log(`│ Basic Auth Login`);
        console.log(`│  Username : ${user.username}`);
        console.log(`│  Email    : ${user.email}`);
        console.log('└─────────────────────────────────────────────\n');

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

async function register(req, res) {
  const { email, password, username, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ erro: 'email e password são obrigatórios.' });
  }

  if (!username || username.trim().length < 3) {
    return res.status(400).json({ erro: 'username é obrigatório (mínimo 3 caracteres).' });
  }

  try {
    const existe = await Utilizador.findOne({ where: { email } });
    if (existe) return res.status(409).json({ erro: 'Email já registado.' });

    const usernameExiste = await Utilizador.findOne({ where: { username: username.trim() } });
    if (usernameExiste) return res.status(409).json({ erro: 'Username já está em uso.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = gerarApiKey();
    const providerId = `basic_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const user = await Utilizador.create({
      providerId,
      provider: 'basic',
      username: username.trim(),
      displayName: displayName || null,
      email,
      passwordHash,
      apiKey,
      role: 'cliente'
    });

    console.log('\n┌─────────────────────────────────────────────');
    console.log('│ Novo Utilizador Registado');
    console.log(`│  Username : ${user.username}`);
    console.log(`│  Email    : ${user.email}`);
    console.log('└─────────────────────────────────────────────\n');

    return res.status(201).json({
      mensagem: 'Utilizador registado com sucesso.',
      id: user.id,
      apiKey: user.apiKey
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

function login(req, res, next) {
  // Usa a strategy local já configurada no passport.
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ erro: info?.message || 'Credenciais inválidas.' });

    req.logIn(user, (err2) => {
      if (err2) return next(err2);
      return res.status(200).json({
        mensagem: 'Login efetuado com sucesso.',
        id: user.id,
        role: user.role,
        apiKey: user.apiKey
      });
    });
  })(req, res, next);
}

function wantsJsonLogoutResponse(req) {
 // Retorna JSON no swagger e redireciona para /login na web.
  return req.accepts(['json', 'html']) === 'json';
}

function logout(req, res) {
  // Captura dados antes de limpar sessão para log de auditoria.
  const autenticado = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  const userId = req.user?.id ?? null;
  const username = req.user?.username ?? '(desconhecido)';
  const email = req.user?.email ?? '(não disponível)';
  const sendJson = wantsJsonLogoutResponse(req);

  if (!autenticado) {
    if (sendJson) {
      return res.status(401).json({ erro: 'Não existe sessão autenticada.' });
    }
    return res.redirect(302, '/login');
  }

  req.logout((err) => {
    if (err) {
      if (sendJson) return res.status(500).json({ erro: 'Erro ao terminar sessão.' });
      return res.redirect(302, '/login');
    }

    console.log('\n┌─────────────────────────────────────────────');
    console.log('│ Logout');
    console.log(`│  User ID  : ${userId ?? '(desconhecido)'}`);
    console.log(`│  Username : ${username}`);
    console.log(`│  Email    : ${email}`);
    console.log('└─────────────────────────────────────────────\n');

    if (sendJson) {
      return res.status(200).json({ mensagem: 'Logout efetuado com sucesso.' });
    }
    return res.redirect(302, '/login');
  });
}

module.exports = { passport, gerarApiKey, register, login, logout };
