
const { Sessao, PlanoTreino, Utilizador } = require('../../models');

const atribsUtilizador = ['id', 'username', 'displayName', 'email', 'avatarUrl', 'role'];


async function listar(req, res) {
  try {
    const estadoQuery   = req.query.estado;
    const planoIdQuery  = req.query.plano_id;
    const clienteIdQuery = req.query.cliente_id;

    let where = {};
    if (req.user.role === 'cliente') {
      where = { clienteId: req.user.id };
    } else if (req.user.role === 'treinador') {
      where = { treinadorId: req.user.id };
    }


    if (estadoQuery) {
      where.estado = estadoQuery;
    }
    if (planoIdQuery !== undefined && planoIdQuery !== null && String(planoIdQuery).trim() !== '') {
      const planoId = Number(planoIdQuery);
      if (!Number.isInteger(planoId) || planoId <= 0) {
        return res.status(400).json({ erro: 'plano_id inválido.' });
      }
      where.planoId = planoId;
    }
    if (clienteIdQuery !== undefined && clienteIdQuery !== null && String(clienteIdQuery).trim() !== '') {
      if (req.user.role === 'cliente') {
        return res.status(403).json({ erro: 'Filtro cliente_id só pode ser usado por admin ou treinador.' });
      }
      const clienteId = Number(clienteIdQuery);
      if (!Number.isInteger(clienteId) || clienteId <= 0) {
        return res.status(400).json({ erro: 'cliente_id inválido.' });
      }
      where.clienteId = clienteId;
    }

    const sessoes = await Sessao.findAll({
      where,
      include: [
        { model: PlanoTreino, as: 'plano',    attributes: ['id', 'titulo', 'objetivo'] },
        { model: Utilizador,  as: 'cliente',  attributes: atribsUtilizador },
        { model: Utilizador,  as: 'treinador', attributes: atribsUtilizador }
      ],
      order: [['dataSessao', 'DESC']]
    });

    return res.status(200).json(sessoes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function obter(req, res) {
  try {
    const sessao = await Sessao.findByPk(req.params.id, {
      include: [
        { model: PlanoTreino, as: 'plano',    attributes: ['id', 'titulo', 'objetivo'] },
        { model: Utilizador,  as: 'cliente',  attributes: atribsUtilizador },
        { model: Utilizador,  as: 'treinador', attributes: atribsUtilizador }
      ]
    });

    if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });

    if (req.user.role === 'cliente' && sessao.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Esta sessão não é sua.' });
    }
    if (req.user.role === 'treinador' && sessao.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Esta sessão não é sua.' });
    }

    return res.status(200).json(sessao);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function criar(req, res) {
  const { planoId, clienteId, dataSessao, duracaoMin, notas } = req.body;

  if (!planoId || !dataSessao || !duracaoMin) {
    return res.status(400).json({ erro: 'planoId, dataSessao e duracaoMin são obrigatórios.' });
  }

  try {
    const plano = await PlanoTreino.findByPk(planoId);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
    if (plano.tipo !== 'profissional') {
      return res.status(403).json({ erro: 'Sessões só podem ser criadas em planos profissionais.' });
    }

    const clienteIdFinal = clienteId ? Number(clienteId) : plano.clienteId;
    const cliente = await Utilizador.findByPk(clienteIdFinal);
    if (!cliente || cliente.role !== 'cliente') {
      return res.status(400).json({ erro: 'Cliente inválido. O plano deve estar associado a um utilizador com role cliente.' });
    }
    if (plano.clienteId !== clienteIdFinal) {
      return res.status(400).json({ erro: 'clienteId não corresponde ao cliente do plano informado.' });
    }

    if (req.user.role === 'treinador') {
      if (plano.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Não pode criar sessões para planos de outro treinador.' });
      }
      if (clienteIdFinal === req.user.id) {
        return res.status(400).json({ erro: 'Treinador não pode criar sessão para si próprio.' });
      }
    }

    const sessao = await Sessao.create({
      planoId,
      clienteId: clienteIdFinal,
      treinadorId: req.user.id,
      dataSessao,
      duracaoMin,
      notas:  notas || null,
      estado: 'agendada'
    });

    return res.status(201).json({ mensagem: 'Sessão criada com sucesso.', id: sessao.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function atualizar(req, res) {
  try {
    const sessao = await Sessao.findByPk(req.params.id);
    if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });

    if (req.user.role === 'cliente' && sessao.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode editar sessões de outro cliente.' });
    }
    if (req.user.role === 'treinador' && sessao.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode editar sessões de outro treinador.' });
    }

    const ESTADOS_VALIDOS = ['agendada', 'concluida', 'cancelada'];
    const { dataSessao, duracaoMin, notas, estado, clienteId, treinadorId, planoId } = req.body;

    if (req.user.role === 'cliente') {
      const tentouEditarCampoNaoPermitido =
        dataSessao !== undefined ||
        duracaoMin !== undefined ||
        estado !== undefined ||
        clienteId !== undefined ||
        treinadorId !== undefined ||
        planoId !== undefined;

      if (tentouEditarCampoNaoPermitido) {
        return res.status(403).json({ erro: 'Cliente só pode atualizar notas da sessão.' });
      }
    }

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ erro: `estado deve ser um de: ${ESTADOS_VALIDOS.join(', ')}` });
    }

    await sessao.update({
      dataSessao: dataSessao ?? sessao.dataSessao,
      duracaoMin: duracaoMin ?? sessao.duracaoMin,
      notas:      notas      ?? sessao.notas,
      estado:     estado     ?? sessao.estado
    });

    return res.status(200).json({ mensagem: 'Sessão atualizada com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}


async function apagar(req, res) {
  try {
    const sessao = await Sessao.findByPk(req.params.id);
    if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada.' });

    if (req.user.role === 'treinador' && sessao.treinadorId !== req.user.id) {
      return res.status(403).json({ erro: 'Não pode apagar sessões de outro treinador.' });
    }

    await sessao.destroy();
    return res.status(200).json({ mensagem: 'Sessão apagada com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { listar, obter, criar, atualizar, apagar };
