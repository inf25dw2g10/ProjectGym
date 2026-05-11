
const { Exercicio, PlanoTreino } = require('../../models');
const { Op } = require('sequelize');

async function listar(req, res) {
  const planoIdParam = req.query.plano_id;
  const clienteIdParam = req.query.cliente_id;

  try {
    const planoId = planoIdParam ? Number(planoIdParam) : null;
    const clienteId = clienteIdParam ? Number(clienteIdParam) : null;
    const temPlanoFiltro = planoIdParam !== undefined && planoIdParam !== null && String(planoIdParam).trim() !== '';
    const temClienteFiltro = clienteIdParam !== undefined && clienteIdParam !== null && String(clienteIdParam).trim() !== '';
    let wherePlano = {};

    if (planoIdParam && (!Number.isInteger(planoId) || planoId <= 0)) {
      return res.status(400).json({ erro: 'plano_id inválido.' });
    }
    if (clienteIdParam && (!Number.isInteger(clienteId) || clienteId <= 0)) {
      return res.status(400).json({ erro: 'cliente_id inválido.' });
    }

    if (req.user.role === 'cliente') {
      wherePlano.clienteId = req.user.id;
      if (clienteIdParam !== undefined && clienteIdParam !== null && String(clienteIdParam).trim() !== '') {
        return res.status(403).json({ erro: 'Filtro cliente_id só pode ser usado por admin ou treinador.' });
      }
    } else if (req.user.role === 'treinador') {
      if (temClienteFiltro) {
        // Treinador pode filtrar por cliente apenas no contexto profissional.
        const planosProfissionaisCliente = await PlanoTreino.findAll({
          where: { clienteId, tipo: 'profissional' },
          attributes: ['treinadorId']
        });
        const clienteTemPlanoProfissional = planosProfissionaisCliente.length > 0;
        const clienteAssociadoAoTreinador = planosProfissionaisCliente.some((p) => p.treinadorId === req.user.id);

        if (!clienteAssociadoAoTreinador && clienteTemPlanoProfissional) {
          return res.status(403).json({ erro: 'Filtro cliente_id não permitido para este cliente.' });
        }
        wherePlano.clienteId = clienteId;
        wherePlano.tipo = 'profissional';
      } else if (!planoId) {
        return res.status(400).json({ erro: 'plano_id é obrigatório para admin/treinador. Ex: /exercicios?plano_id=1' });
      }
    } else if (req.user.role === 'admin' && temClienteFiltro) {
      wherePlano.clienteId = clienteId;
    }

    if (planoId) wherePlano.id = planoId;

    let planos = await PlanoTreino.findAll({
      where: wherePlano,
      attributes: ['id', 'clienteId', 'treinadorId'],
      order: [['id', 'ASC']]
    });

    if (req.user.role === 'treinador') {
      // remove planos que não pertencem ao treinador.
      planos = planos.filter((p) => {
        if (p.treinadorId === req.user.id) return true;
        return p.treinadorId === null;
      });
    }

    if (planos.length === 0) {
      if (req.user.role === 'cliente' && !planoId) {
        return res.status(404).json({ erro: 'Não tens planos associados, por isso não tens exercícios para listar.' });
      }
      return res.status(200).json([]);
    }

    if (req.user.role === 'cliente') {
      const planoNaoPermitido = planos.find((p) => p.clienteId !== req.user.id);
      if (planoNaoPermitido) {
        return res.status(403).json({ erro: 'Acesso negado. Este plano não é seu.' });
      }
    }
    if (req.user.role === 'treinador' && planoId) {
      const plano = planos[0];
      if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
      if (!wherePlano.clienteId && plano.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Acesso negado. Este plano não é seu.' });
      }
    }

    const exercicios = await Exercicio.findAll({
      where: { planoId: { [Op.in]: planos.map((p) => p.id) } },
      order: [['planoId', 'ASC'], ['ordem', 'ASC']]
    });

    return res.status(200).json(exercicios);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function obter(req, res) {
  try {
    const exercicio = await Exercicio.findByPk(req.params.id, {
      include: [{ model: PlanoTreino, as: 'plano', attributes: ['id', 'titulo', 'clienteId', 'treinadorId'] }]
    });

    if (!exercicio) return res.status(404).json({ erro: 'Exercício não encontrado.' });

    if (req.user.role === 'cliente' && exercicio.plano.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este exercício não pertence a um plano seu.' });
    }
    if (req.user.role === 'treinador' && exercicio.plano.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este exercício não pertence a um plano seu.' });
    }

    return res.status(200).json(exercicio);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function criar(req, res) {
  const { planoId, nome, grupoMuscular, series, reps, pesoKg, notas, ordem } = req.body;

  if (!planoId || !nome || !grupoMuscular || !series || !reps) {
    return res.status(400).json({ erro: 'planoId, nome, grupoMuscular, series e reps são obrigatórios.' });
  }

  try {
    const plano = await PlanoTreino.findByPk(planoId);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });

    if (req.user.role === 'cliente') {
      if (plano.clienteId !== req.user.id) {
        return res.status(403).json({ erro: 'Cliente só pode criar exercícios nos seus próprios planos.' });
      }
      if (plano.tipo !== 'pessoal') {
        return res.status(403).json({ erro: 'Cliente só pode criar exercícios em planos pessoais.' });
      }
    } else if (req.user.role === 'treinador') {
      if (plano.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Treinador só pode criar exercícios nos seus próprios planos.' });
      }
    }

    const exercicio = await Exercicio.create({
      planoId,
      nome,
      grupoMuscular,
      series,
      reps,
      pesoKg:  pesoKg || null,
      notas:   notas  || null,
      ordem:   ordem  || 1
    });

    return res.status(201).json({ mensagem: 'Exercício criado com sucesso.', id: exercicio.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function atualizar(req, res) {
  try {
    const exercicio = await Exercicio.findByPk(req.params.id, {
      include: [{ model: PlanoTreino, as: 'plano', attributes: ['id', 'clienteId', 'treinadorId', 'tipo'] }]
    });
    if (!exercicio) return res.status(404).json({ erro: 'Exercício não encontrado.' });

    const { nome, grupoMuscular, series, reps, pesoKg, notas, ordem, planoId, treinadorId, clienteId, tipo } = req.body;

    if (req.user.role === 'cliente') {
      if (exercicio.plano.clienteId !== req.user.id) {
        return res.status(403).json({ erro: 'Acesso negado. Este exercício não pertence a um plano seu.' });
      }
      if (planoId !== undefined || treinadorId !== undefined || clienteId !== undefined || tipo !== undefined) {
        return res.status(403).json({ erro: 'Não pode alterar associações do exercício.' });
      }

      if (exercicio.plano.tipo === 'pessoal') {
        await exercicio.update({
          nome:          nome          ?? exercicio.nome,
          grupoMuscular: grupoMuscular ?? exercicio.grupoMuscular,
          series:        series        ?? exercicio.series,
          reps:          reps          ?? exercicio.reps,
          pesoKg:        pesoKg        ?? exercicio.pesoKg,
          notas:         notas         ?? exercicio.notas,
          ordem:         ordem         ?? exercicio.ordem
        });
      } else {
        const tentouEditarCampoNaoPermitido =
          nome !== undefined ||
          grupoMuscular !== undefined ||
          ordem !== undefined;
        if (tentouEditarCampoNaoPermitido) {
          return res.status(403).json({ erro: 'Em plano profissional, cliente só pode alterar series, reps, pesoKg e notas.' });
        }
        await exercicio.update({
          series:        series        ?? exercicio.series,
          reps:          reps          ?? exercicio.reps,
          pesoKg:        pesoKg        ?? exercicio.pesoKg,
          notas:         notas         ?? exercicio.notas
        });
      }
    } else {

      if (req.user.role === 'treinador' && exercicio.plano.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Não pode editar exercícios de planos de outro treinador.' });
      }
      await exercicio.update({
        nome:          nome          ?? exercicio.nome,
        grupoMuscular: grupoMuscular ?? exercicio.grupoMuscular,
        series:        series        ?? exercicio.series,
        reps:          reps          ?? exercicio.reps,
        pesoKg:        pesoKg        ?? exercicio.pesoKg,
        notas:         notas         ?? exercicio.notas,
        ordem:         ordem         ?? exercicio.ordem
      });
    }

    return res.status(200).json({ mensagem: 'Exercício atualizado com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function apagar(req, res) {
  try {
    const exercicio = await Exercicio.findByPk(req.params.id, {
      include: [{ model: PlanoTreino, as: 'plano', attributes: ['clienteId', 'treinadorId', 'tipo'] }]
    });
    if (!exercicio) return res.status(404).json({ erro: 'Exercício não encontrado.' });

    if (req.user.role === 'cliente') {
      if (exercicio.plano.clienteId !== req.user.id) {
        return res.status(403).json({ erro: 'Acesso negado.' });
      }
      if (exercicio.plano.tipo !== 'pessoal') {
        return res.status(403).json({ erro: 'Cliente só pode apagar exercícios de planos pessoais.' });
      }
    } else if (req.user.role === 'treinador' && exercicio.plano.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode apagar exercícios de planos de outro treinador.' });
    }

    await exercicio.destroy();
    return res.status(200).json({ mensagem: 'Exercício apagado com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { listar, obter, criar, atualizar, apagar };
