
const { PlanoTreino, Utilizador } = require('../../models');
const { Op } = require('sequelize');

const OBJETIVOS_VALIDOS = ['emagrecimento', 'hipertrofia', 'resistencia', 'flexibilidade', 'saude_geral'];
const atribsUtilizador  = ['id', 'username', 'displayName', 'email', 'avatarUrl', 'role'];

async function listar(req, res) {
  try {
    const clienteIdQuery = req.query.cliente_id;
    let where = {};

    if (req.user.role === 'cliente') {
      where = { clienteId: req.user.id };
    } else if (req.user.role === 'treinador') {
      // Sem filtros, treinador só vê os planos em que é responsável.
      where = { treinadorId: req.user.id };
    }

    if (clienteIdQuery !== undefined && clienteIdQuery !== null && String(clienteIdQuery).trim() !== '') {
      if (req.user.role === 'cliente') {
        return res.status(403).json({ erro: 'Filtro cliente_id só pode ser usado por admin ou treinador.' });
      }

      const clienteIdFiltro = Number(clienteIdQuery);
      if (!Number.isInteger(clienteIdFiltro) || clienteIdFiltro <= 0) {
        return res.status(400).json({ erro: 'cliente_id inválido.' });
      }

      if (req.user.role === 'treinador') {
        // Com cliente_id, treinador só pode ver planos profissionais dele nesse cliente.
        const planosProfissionaisCliente = await PlanoTreino.findAll({
          where: { clienteId: clienteIdFiltro, tipo: 'profissional' },
          attributes: ['treinadorId']
        });
        const clienteTemPlanoProfissional = planosProfissionaisCliente.length > 0;
        const clienteAssociadoAoTreinador = planosProfissionaisCliente.some((p) => p.treinadorId === req.user.id);

        if (!clienteAssociadoAoTreinador && clienteTemPlanoProfissional) {
          return res.status(403).json({ erro: 'Filtro cliente_id não permitido para este cliente.' });
        }

        where = { clienteId: clienteIdFiltro, tipo: 'profissional', treinadorId: req.user.id };
      } else {
        where = { ...where, clienteId: clienteIdFiltro };
      }
    }

    const planos = await PlanoTreino.findAll({
      where,
      include: [
        { model: Utilizador, as: 'treinador', attributes: atribsUtilizador },
        { model: Utilizador, as: 'cliente',   attributes: atribsUtilizador }
      ],
      order: [['id', 'ASC']]
    });

    return res.status(200).json(planos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function obter(req, res) {
  try {
    const plano = await PlanoTreino.findByPk(req.params.id, {
      include: [
        { model: Utilizador, as: 'treinador', attributes: atribsUtilizador },
        { model: Utilizador, as: 'cliente',   attributes: atribsUtilizador }
      ]
    });

    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });

    if (req.user.role === 'cliente' && plano.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este plano não é seu.' });
    }
    if (req.user.role === 'treinador' && plano.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este plano não é seu.' });
    }

    return res.status(200).json(plano);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function criar(req, res) {
  const { titulo, descricao, objetivo, duracaoSem } = req.body;
  const clienteIdPayload = req.body.clienteId ?? req.body.cliente_id;
  const treinadorIdPayload = req.body.treinadorId ?? req.body.treinador_id;

  if (!titulo || !objetivo || !duracaoSem) {
    return res.status(400).json({ erro: 'titulo, objetivo e duracaoSem são obrigatórios.' });
  }

  if (!OBJETIVOS_VALIDOS.includes(objetivo)) {
    return res.status(400).json({ erro: `objetivo deve ser um de: ${OBJETIVOS_VALIDOS.join(', ')}` });
  }

  try {
    let tipo, treinadorId, clienteIdFinal;

    if (req.user.role === 'cliente') {
      // Cliente só pode criar plano pessoal para si.

      if (clienteIdPayload !== undefined && clienteIdPayload !== null && Number(clienteIdPayload) !== req.user.id) {
        return res.status(403).json({ erro: 'clienteId inválido. Cliente só pode criar plano para si próprio.' });
      }
      if (treinadorIdPayload !== undefined && treinadorIdPayload !== null) {
        return res.status(403).json({ erro: 'Cliente não pode associar treinador ao plano pessoal.' });
      }
      tipo          = 'pessoal';
      treinadorId   = null;
      clienteIdFinal = req.user.id;
    } else {
      // Treinador/admin criam plano profissional para um cliente.

      if (!clienteIdPayload) {
        return res.status(400).json({ erro: 'clienteId é obrigatório para treinadores.' });
      }
      const cliente = await Utilizador.findByPk(clienteIdPayload);
      if (!cliente || cliente.role !== 'cliente') {
        return res.status(400).json({ erro: 'clienteId inválido. Deve referenciar um utilizador com role cliente.' });
      }
      if (req.user.role === 'treinador' && Number(clienteIdPayload) === req.user.id) {
        return res.status(400).json({ erro: 'Treinador não pode criar plano para si próprio.' });
      }
      if (req.user.role === 'treinador' && treinadorIdPayload !== undefined && Number(treinadorIdPayload) !== req.user.id) {
        return res.status(403).json({ erro: 'Treinador não pode associar outro treinador ao plano.' });
      }
      if (req.user.role === 'treinador') {
        const planoOutroTreinador = await PlanoTreino.findOne({
          where: {
            clienteId: Number(clienteIdPayload),
            tipo: 'profissional',
            treinadorId: { [Op.ne]: req.user.id }
          }
        });
        if (planoOutroTreinador) {
          return res.status(403).json({ erro: 'Cliente já está associado a outro treinador.' });
        }
      }
      tipo          = 'profissional';
      treinadorId   = req.user.id;
      clienteIdFinal = clienteIdPayload;
    }

    const plano = await PlanoTreino.create({
      titulo,
      descricao: descricao || null,
      objetivo,
      duracaoSem,
      tipo,
      treinadorId,
      clienteId: clienteIdFinal
    });

    return res.status(201).json({ mensagem: 'Plano criado com sucesso.', id: plano.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function atualizar(req, res) {
  try {
    const plano = await PlanoTreino.findByPk(req.params.id);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });

    if (req.user.role === 'treinador' && plano.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode editar planos de outro treinador.' });
    }
    if (req.user.role === 'treinador' && plano.tipo !== 'profissional') {
      return res.status(403).json({ erro: 'Treinador não pode editar planos pessoais.' });
    }
    if (req.user.role === 'cliente' && plano.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode editar planos de outro cliente.' });
    }
    if (req.user.role === 'cliente' && plano.tipo === 'profissional') {
      return res.status(403).json({ erro: 'Cliente não pode editar planos do tipo profissional.' });
    }

    const { titulo, descricao, objetivo, duracaoSem, ativo } = req.body;
    const tentouAlterarCamposProtegidos =
      req.body.treinadorId !== undefined ||
      req.body.clienteId !== undefined ||
      req.body.tipo !== undefined;

    if (tentouAlterarCamposProtegidos && req.user.role !== 'admin') {
      return res.status(403).json({ erro: 'Não pode alterar treinadorId, clienteId ou tipo do plano.' });
    }

    if (objetivo && !OBJETIVOS_VALIDOS.includes(objetivo)) {
      return res.status(400).json({ erro: `objetivo deve ser um de: ${OBJETIVOS_VALIDOS.join(', ')}` });
    }

    await plano.update({
      titulo:     titulo     ?? plano.titulo,
      descricao:  descricao  ?? plano.descricao,
      objetivo:   objetivo   ?? plano.objetivo,
      duracaoSem: duracaoSem ?? plano.duracaoSem,
      ativo:      ativo      ?? plano.ativo
    });

    return res.status(200).json({ mensagem: 'Plano atualizado com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function apagar(req, res) {
  try {
    const plano = await PlanoTreino.findByPk(req.params.id);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });

    if (req.user.role === 'treinador' && plano.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode apagar planos de outro treinador.' });
    }
    if (req.user.role === 'treinador' && plano.tipo !== 'profissional') {
      return res.status(403).json({ erro: 'Treinador não pode apagar planos pessoais.' });
    }
    if (req.user.role === 'cliente' && plano.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode apagar planos de outro cliente.' });
    }
    if (req.user.role === 'cliente' && plano.tipo !== 'pessoal') {
      return res.status(403).json({ erro: 'Cliente só pode apagar planos pessoais próprios.' });
    }

    await plano.destroy();
    return res.status(200).json({ mensagem: 'Plano apagado com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { listar, obter, criar, atualizar, apagar };
