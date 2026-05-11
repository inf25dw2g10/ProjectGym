

const basicAuth = require('basic-auth');
const bcrypt = require('bcryptjs');
const { Utilizador } = require('../../models');

const API_KEY_HEADER = 'x-api-key';

function logAuthenticatedUser(req, kind = 'autenticado') {
  const u = req.user;
  if (!u) return;

  console.log('\n┌─────────────────────────────────────────────');
  console.log(`│ Utilizador ${kind}`);
  console.log(`│  ID       : ${u.id}`);
  console.log(`│  Username : ${u.username}`);
  console.log(`│  Nome     : ${u.displayName || u.username}`);
  console.log(`│  Email    : ${u.email || '(não disponível)'}`);
  console.log(`│  Provider : ${u.provider}`);
  console.log(`│  Role     : ${u.role}`);
  console.log(`│  Rota     : ${req.method} ${req.originalUrl}`);
  console.log(`│  Data/Hora: ${new Date().toISOString()}`);
  console.log('└─────────────────────────────────────────────\n');
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    logAuthenticatedUser(req, 'autenticado (sessão/cookie)');
    return next();
  }
  return res.status(401).json({ erro: 'Autenticação necessária. Faça login em /login.' });
}

async function ensureApiKey(req, res, next) {
  const apiKey = req.get(API_KEY_HEADER);
  if (!apiKey) return res.status(401).json({ erro: 'Autenticação necessária. Use X-API-Key.' });

  try {
    // API key identifica o utilizador sem depender de sessão/cookies.
    const user = await Utilizador.findOne({ where: { apiKey } });
    if (!user) return res.status(401).json({ erro: 'API Key inválida.' });
    req.user = user;
    logAuthenticatedUser(req, 'autenticado (API key)');
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function ensureAnyAuth(req, res, next) {
  // Mantém o comportamento do dashboard: se há sessão, usa sessão.
  if (req.isAuthenticated && req.isAuthenticated()) {
    logAuthenticatedUser(req, 'autenticado (sessão/cookie)');
    return next();
  }

  const apiKey = req.get(API_KEY_HEADER);
  if (apiKey) {
    // Se o header existe, delega toda a validação para ensureApiKey.
    return ensureApiKey(req, res, next);
  }

  const authHeader = req.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('basic ')) {
    return ensureBasicAuth(req, res, next);
  }

  return res.status(401).json({ erro: 'Autenticação necessária. Faça login em /login, use X-API-Key ou Authorization: Basic.' });
}

async function ensureBasicAuth(req, res, next) {
  const credentials = basicAuth(req);
  if (!credentials?.name || !credentials?.pass) {
    res.set('WWW-Authenticate', 'Basic realm="Authorization Required"');
    return res.sendStatus(401);
  }

  try {
    // Basic só autentica utilizadores do provider "basic".
    const user = await Utilizador.findOne({
      where: { provider: 'basic', username: credentials.name }
    });
    if (!user) {
      res.set('WWW-Authenticate', 'Basic realm="Authorization Required"');
      return res.sendStatus(401);
    }

    const ok = await bcrypt.compare(credentials.pass, user.passwordHash);
    if (!ok) {
      res.set('WWW-Authenticate', 'Basic realm="Authorization Required"');
      return res.sendStatus(401);
    }

    req.user = user;
    logAuthenticatedUser(req, 'autenticado (Basic Auth)');
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

function basicAuthLoginMiddleware(req, res, next) {
  const usernameOrEmailFromBody = req.body.usernameOrEmail || req.body.email;
  const passwordFromBody = req.body.password;

  if (usernameOrEmailFromBody && passwordFromBody) {
    req.body.usernameOrEmail = usernameOrEmailFromBody;
    req.body.password = passwordFromBody;
    return next();
  }

  const authHeader = req.get('authorization') || '';

  if (authHeader.toLowerCase().startsWith('basic ')) {
    try {
      const base64 = authHeader.slice('basic '.length);
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      if (sep === -1) {
        return res.status(400).json({ erro: 'Formato inválido. Esperado: username:password em base64.' });
      }

      const usernameOrEmail = decoded.slice(0, sep);
      const password = decoded.slice(sep + 1);
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ erro: 'Username/email e password são obrigatórios.' });
      }

      req.body.usernameOrEmail = usernameOrEmail;
      req.body.password = password;
      return next();
    } catch (err) {
      console.error('Erro ao processar Basic Auth header:', err);
      return res.status(400).json({ erro: 'Header Authorization inválido.' });
    }
  }

  if (!usernameOrEmailFromBody || !passwordFromBody) {
    return res.status(401).json({
      erro: 'Credenciais em falta. Envie { usernameOrEmail, password } no body ou use o header Authorization: Basic.'
    });
  }
}
 
function ensureRole(...roles) {
  return (req, res, next) => {
    // Validação simples de autorização por role.
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        erro: `Acesso negado. Requer role: ${roles.join(' ou ')}.`
      });
    }
    next();
  };
}
 
module.exports = {
  API_KEY_HEADER,
  ensureAuthenticated,
  ensureApiKey,
  ensureAnyAuth,
  ensureBasicAuth,
  basicAuthLoginMiddleware,
  ensureRole
};
