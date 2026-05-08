const crypto     = require('crypto');
const { Utilizador } = require('../../models');

const CAMPOS_PUBLICOS  = ['id', 'provider', 'username', 'displayName', 'email', 'avatarUrl', 'role', 'createdAt'];
const CAMPOS_SENSIVEIS = ['passwordHash', 'apiKey', 'providerId'];


async function listar(req, res) {
  try {
    const users = await Utilizador.findAll({
      attributes: CAMPOS_PUBLICOS,
      order: [['createdAt', 'ASC']]
    });
    return res.status(200).json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


function me(req, res) {
  const dados = req.user.dataValues || req.user;
  const safe  = Object.fromEntries(
    Object.entries(dados).filter(([k]) => !CAMPOS_SENSIVEIS.includes(k))
  );
  return res.status(200).json(safe);
}


async function regenerarApiKey(req, res) {
  try {
    const novaKey = crypto.randomBytes(32).toString('hex');
    await req.user.update({ apiKey: novaKey });
    return res.status(200).json({ mensagem: 'API key regenerada.', apiKey: novaKey });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function alterarRole(req, res) {
  const rolesValidas = ['admin', 'treinador', 'cliente'];
  const { role } = req.body;

  if (!role || !rolesValidas.includes(role)) {
    return res.status(400).json({ erro: `role deve ser um de: ${rolesValidas.join(', ')}` });
  }

  try {
    const user = await Utilizador.findByPk(req.params.id);
    if (!user) return res.status(404).json({ erro: 'Utilizador não encontrado.' });

    await user.update({ role });
    return res.status(200).json({ mensagem: 'Role atualizado com sucesso.', id: user.id, role: user.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { listar, me, regenerarApiKey, alterarRole };