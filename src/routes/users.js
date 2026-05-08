
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { Op } = require('sequelize');
const { Utilizador, PlanoTreino } = require('../../models');
const { ensureAnyAuth, ensureRole } = require('../middleware/auth');

router.get('/', ensureAnyAuth, ensureRole('admin', 'treinador'), async (req, res) => {
  try {
    const clienteIdQuery = req.query.cliente_id;
    const treinadorIdQuery = req.query.treinador_id;
    let where = {};

    if (treinadorIdQuery !== undefined && treinadorIdQuery !== null && String(treinadorIdQuery).trim() !== '') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ erro: 'Filtro treinador_id só pode ser usado por admin.' });
      }
      const treinadorIdFiltro = Number(treinadorIdQuery);
      if (!Number.isInteger(treinadorIdFiltro) || treinadorIdFiltro <= 0) {
        return res.status(400).json({ erro: 'treinador_id inválido.' });
      }
      const planosDoTreinadorFiltrado = await PlanoTreino.findAll({
        where: { treinadorId: treinadorIdFiltro, tipo: 'profissional', clienteId: { [Op.ne]: null } },
        attributes: ['clienteId'],
        group: ['clienteId']
      });
      const clienteIdsTreinador = planosDoTreinadorFiltrado.map((p) => p.clienteId);
      if (clienteIdsTreinador.length === 0) return res.status(200).json([]);
      // Para admin, este filtro devolve só clientes ligados ao treinador pedido.
      where = { ...where, id: { [Op.in]: clienteIdsTreinador }, role: 'cliente' };
    }

    if (req.user.role === 'treinador') {
      // Clientes "permitidos" para treinador:
      // 1) clientes já dele; 2) clientes sem treinador profissional.
      const planosDoTreinador = await PlanoTreino.findAll({
        where: { treinadorId: req.user.id, tipo: 'profissional', clienteId: { [Op.ne]: null } },
        attributes: ['clienteId'],
        group: ['clienteId']
      });
      const clienteIds = planosDoTreinador
        .map((p) => p.clienteId);
      let clienteIdsFiltrados = clienteIds;
      if (clienteIds.length > 0) {
        const planosDeOutrosTreinadores = await PlanoTreino.findAll({
          where: {
            clienteId: { [Op.in]: clienteIds },
            tipo: 'profissional',
            treinadorId: { [Op.ne]: req.user.id }
          },
          attributes: ['clienteId'],
          group: ['clienteId']
        });
        const bloqueados = new Set(planosDeOutrosTreinadores.map((p) => p.clienteId));
        clienteIdsFiltrados = clienteIds.filter((id) => !bloqueados.has(id));
      }

      const clientesComAlgumTreinador = await PlanoTreino.findAll({
        where: {
          tipo: 'profissional',
          treinadorId: { [Op.ne]: null },
          clienteId: { [Op.ne]: null }
        },
        attributes: ['clienteId'],
        group: ['clienteId']
      });
      const idsComTreinador = new Set(clientesComAlgumTreinador.map((p) => p.clienteId));

      const whereSemTreinador = { role: 'cliente' };
      if (idsComTreinador.size > 0) {
        whereSemTreinador.id = { [Op.notIn]: [...idsComTreinador] };
      }

      const clientesSemTreinador = await Utilizador.findAll({
        where: whereSemTreinador,
        attributes: ['id']
      });
      const idsSemTreinador = clientesSemTreinador.map((u) => u.id);

      const idsPermitidos = [...new Set([...clienteIdsFiltrados, ...idsSemTreinador])];
      if (idsPermitidos.length === 0) return res.status(200).json([]);

      where = { id: { [Op.in]: idsPermitidos }, role: 'cliente' };
    }

    if (clienteIdQuery !== undefined && clienteIdQuery !== null && String(clienteIdQuery).trim() !== '') {
      const clienteIdFiltro = Number(clienteIdQuery);
      if (!Number.isInteger(clienteIdFiltro) || clienteIdFiltro <= 0) {
        return res.status(400).json({ erro: 'cliente_id inválido.' });
      }

      if (req.user.role === 'treinador') {
        // Treinador só pode filtrar clientes do seu âmbito (ou sem treinador).
        const planosProfissionaisCliente = await PlanoTreino.findAll({
          where: { clienteId: clienteIdFiltro, tipo: 'profissional' },
          attributes: ['treinadorId']
        });
        const clienteTemPlanoProfissional = planosProfissionaisCliente.length > 0;
        const clienteAssociadoAoTreinador = planosProfissionaisCliente.some((p) => p.treinadorId === req.user.id);

        if (!clienteAssociadoAoTreinador && clienteTemPlanoProfissional) {
          return res.status(403).json({ erro: 'Filtro cliente_id não permitido para este cliente.' });
        }
      }

      if (where.id && where.id[Op.in]) {
        // Se já existe uma lista permitida, o filtro cliente_id só reduz essa lista.
        const idsFiltrados = where.id[Op.in].filter((id) => id === clienteIdFiltro);
        if (idsFiltrados.length === 0) return res.status(200).json([]);
        where = { ...where, id: { [Op.in]: idsFiltrados }, role: 'cliente' };
      } else {
        where = { ...where, id: clienteIdFiltro, role: 'cliente' };
      }
    }

    const users = await Utilizador.findAll({
      where,
      attributes: ['id', 'providerId', 'provider', 'username', 'displayName', 'email', 'avatarUrl', 'role', 'createdAt'],
      order: [['createdAt', 'ASC']]
    });
    return res.status(200).json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

router.get('/me', ensureAnyAuth, (req, res) => {
  const { passwordHash, ...safe } = req.user.dataValues || req.user;
  return res.status(200).json(safe);
});

router.post('/me/api-key', ensureAnyAuth, async (req, res) => {
  try {
    const novaKey = crypto.randomBytes(32).toString('hex');
    await req.user.update({ apiKey: novaKey });
    return res.status(200).json({ mensagem: 'API key regenerada.', apiKey: novaKey });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

router.put('/:id/role', ensureAnyAuth, ensureRole('admin'), async (req, res) => {
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
});

module.exports = router;
