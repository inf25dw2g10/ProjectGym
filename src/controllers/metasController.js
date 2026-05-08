
const { Op } = require('sequelize');
const { Meta, Utilizador, PlanoTreino } = require('../../models');

const atribsUtilizador = ['id', 'username', 'displayName', 'email', 'role'];


async function listar(req, res) {
  try {
    const clienteIdQuery = req.query.cliente_id;
    const planoIdQuery = req.query.plano_id;
    let where = {};
    let includePlano = { model: PlanoTreino, as: 'plano', attributes: ['id', 'titulo'] };

    if (req.user.role === 'cliente') {
      where = { clienteId: req.user.id };
    } else if (req.user.role === 'treinador') {
      includePlano = {
        model: PlanoTreino,
        as: 'plano',
        attributes: ['id', 'titulo'],
        where: { treinadorId: req.user.id, tipo: 'profissional' },
        required: true
      };
    }

    if (planoIdQuery !== undefined && planoIdQuery !== null && String(planoIdQuery).trim() !== '') {
      const planoIdFiltro = Number(planoIdQuery);
      if (!Number.isInteger(planoIdFiltro) || planoIdFiltro <= 0) {
        return res.status(400).json({ erro: 'plano_id inválido.' });
      }
      where = { ...where, planoId: planoIdFiltro };
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
        const planosProfissionaisCliente = await PlanoTreino.findAll({
          where: { clienteId: clienteIdFiltro, tipo: 'profissional' },
          attributes: ['treinadorId']
        });
        const clienteTemPlanoProfissional = planosProfissionaisCliente.length > 0;
        const clienteAssociadoAoTreinador = planosProfissionaisCliente.some((p) => p.treinadorId === req.user.id);

        if (!clienteAssociadoAoTreinador && clienteTemPlanoProfissional) {
          return res.status(403).json({ erro: 'Filtro cliente_id não permitido para este cliente.' });
        }

        where = { ...where, clienteId: clienteIdFiltro };
        includePlano = {
          model: PlanoTreino,
          as: 'plano',
          attributes: ['id', 'titulo'],
          where: { treinadorId: req.user.id, tipo: 'profissional' },
          required: true
        };
      } else {
        where = { ...where, clienteId: clienteIdFiltro };
      }
    }

    const metas = await Meta.findAll({
      where,
      include: [
        { model: Utilizador, as: 'cliente', attributes: atribsUtilizador },
        includePlano
      ],
      order: [['prazo', 'ASC']]
    });

    return res.status(200).json(metas);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function obter(req, res) {
  try {
    const meta = await Meta.findByPk(req.params.id, {
      include: [
        { model: Utilizador,  as: 'cliente', attributes: atribsUtilizador },
        { model: PlanoTreino, as: 'plano', attributes: ['id', 'titulo', 'treinadorId', 'tipo'] }
      ]
    });

    if (!meta) return res.status(404).json({ erro: 'Meta não encontrada.' });

    if (req.user.role === 'cliente' && meta.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }
    if (req.user.role === 'treinador') {
      if (!meta.plano || meta.plano.treinadorId !== req.user.id || meta.plano.tipo !== 'profissional') {
        return res.status(403).json({ erro: 'Acesso negado.' });
      }
    }

    return res.status(200).json(meta);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function criar(req, res) {
  const { clienteId, planoId, descricao, valorAlvo, unidade, prazo } = req.body;
  const clienteIdPayload = req.body.clienteId ?? req.body.cliente_id;

  if (!descricao) {
    return res.status(400).json({ erro: 'descricao é obrigatória.' });
  }
  if (!planoId) {
    return res.status(400).json({ erro: 'planoId é obrigatório. Meta deve pertencer a um plano.' });
  }

  try {
    let clienteIdFinal, tipo;

    if (req.user.role === 'cliente') {
      const plano = await PlanoTreino.findByPk(planoId);
      if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });

      if (plano.clienteId !== req.user.id) {
        return res.status(403).json({ erro: 'Cliente só pode criar metas nos seus próprios planos.' });
      }
      if (plano.tipo !== 'pessoal') {
        return res.status(403).json({ erro: 'Cliente só pode criar metas em planos pessoais.' });
      }
      if (clienteIdPayload !== undefined && clienteIdPayload !== null && Number(clienteIdPayload) !== req.user.id) {
        return res.status(403).json({ erro: 'clienteId inválido. Cliente só pode criar metas para si próprio.' });
      }

      clienteIdFinal = req.user.id;
      tipo           = 'pessoal';
    } else {
      let clienteIdResolvido = clienteIdPayload ? Number(clienteIdPayload) : null;
      const plano = await PlanoTreino.findByPk(planoId);
      if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
      if (clienteIdResolvido === null) {
        clienteIdResolvido = plano.clienteId;
      } else if (plano.clienteId !== clienteIdResolvido) {
        return res.status(400).json({ erro: 'clienteId não corresponde ao cliente do plano informado.' });
      }
      if (plano.tipo !== 'profissional') {
        return res.status(403).json({ erro: 'Treinador só pode criar metas em planos profissionais.' });
      }

      const cliente = await Utilizador.findByPk(clienteIdResolvido);
      if (!cliente || cliente.role !== 'cliente') {
        return res.status(400).json({ erro: 'clienteId inválido. Deve referenciar um utilizador com role cliente.' });
      }
      if (req.user.role === 'treinador' && clienteIdResolvido === req.user.id) {
        return res.status(400).json({ erro: 'Treinador não pode criar metas para si próprio.' });
      }
      if (req.user.role === 'treinador' && plano.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Não pode criar metas para planos de outro treinador.' });
      }

      clienteIdFinal = clienteIdResolvido;
      tipo           = 'profissional';
    }

    const meta = await Meta.create({
      clienteId: clienteIdFinal,
      planoId:   planoId   || null,
      tipo,
      descricao,
      valorAlvo:  valorAlvo  || null,
      valorAtual: 0,
      unidade:    unidade    || null,
      prazo:      prazo      || null,
      estado:     'ativa'
    });

    return res.status(201).json({ mensagem: 'Meta criada com sucesso.', id: meta.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function atualizar(req, res) {
  try {
    const meta = await Meta.findByPk(req.params.id, {
      include: [{ model: PlanoTreino, as: 'plano', attributes: ['id', 'clienteId', 'treinadorId', 'tipo'] }]
    });
    if (!meta) return res.status(404).json({ erro: 'Meta não encontrada.' });

    const isAdmin = req.user.role === 'admin';

    if (req.user.role === 'cliente') {
      const metaTemPlanoPessoalDoCliente =
        meta.plano &&
        meta.plano.clienteId === req.user.id &&
        meta.plano.tipo === 'pessoal';
      if (!metaTemPlanoPessoalDoCliente) {
        return res.status(403).json({ erro: 'Cliente só pode editar metas de planos pessoais próprios.' });
      }
    } else if (req.user.role === 'treinador') {
      if (!meta.plano || meta.plano.tipo !== 'profissional' || meta.plano.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Treinador só pode editar metas profissionais dos seus planos.' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const ESTADOS_VALIDOS = ['ativa', 'concluida', 'cancelada'];
    const { descricao, valorAlvo, valorAtual, unidade, prazo, estado } = req.body;

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ erro: `estado deve ser um de: ${ESTADOS_VALIDOS.join(', ')}` });
    }

    await meta.update({
      descricao:  descricao  ?? meta.descricao,
      valorAlvo:  valorAlvo  ?? meta.valorAlvo,
      valorAtual: valorAtual ?? meta.valorAtual,
      unidade:    unidade    ?? meta.unidade,
      prazo:      prazo      ?? meta.prazo,
      estado:     estado     ?? meta.estado
    });

    return res.status(200).json({ mensagem: 'Meta atualizada com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function apagar(req, res) {
  try {
    const meta = await Meta.findByPk(req.params.id, {
      include: [{ model: PlanoTreino, as: 'plano', attributes: ['id', 'clienteId', 'treinadorId', 'tipo'] }]
    });
    if (!meta) return res.status(404).json({ erro: 'Meta não encontrada.' });

    if (req.user.role === 'cliente') {
      if (!meta.plano || meta.plano.clienteId !== req.user.id || meta.plano.tipo !== 'pessoal') {
        return res.status(403).json({ erro: 'Cliente só pode apagar metas de planos pessoais próprios.' });
      }
    }
    if (req.user.role === 'treinador') {
      if (!meta.plano || meta.plano.tipo !== 'profissional' || meta.plano.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Treinador só pode apagar metas profissionais dos seus planos.' });
      }
    }

    await meta.destroy();
    return res.status(200).json({ mensagem: 'Meta apagada com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { listar, obter, criar, atualizar, apagar };
