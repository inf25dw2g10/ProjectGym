
const { Op } = require('sequelize');
const { AvaliacaoFisica, Utilizador, PlanoTreino } = require('../../models');

const atribsUtilizador = ['id', 'username', 'displayName', 'email', 'role'];

function calcularImc(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm || alturaCm === 0) return null;
  const alturaM = alturaCm / 100;
  return parseFloat((pesoKg / (alturaM * alturaM)).toFixed(2));
}

async function listar(req, res) {
  try {
    const clienteIdQuery = req.query.cliente_id;
    let where = {};
    if (req.user.role === 'cliente') {
      where = { clienteId: req.user.id };
    } else if (req.user.role === 'treinador') {
      const planos = await PlanoTreino.findAll({
        where: { treinadorId: req.user.id },
        attributes: ['clienteId']
      });
      const idsClientes = [...new Set(planos.map((p) => p.clienteId))];
      if (idsClientes.length === 0) {
        return res.status(200).json([]);
      }
      where = { clienteId: { [Op.in]: idsClientes } };
    }

    if (clienteIdQuery !== undefined && clienteIdQuery !== null && String(clienteIdQuery).trim() !== '') {
      if (req.user.role !== 'cliente') {
        const cid = Number(clienteIdQuery);
        if (req.user.role === 'treinador' && where?.clienteId?.[Op.in] && !where.clienteId[Op.in].includes(cid)) {
          return res.status(200).json([]);
        }
        where = { ...where, clienteId: cid };
      }
    }

    const avaliacoes = await AvaliacaoFisica.findAll({
      where,
      attributes: { exclude: ['treinadorId'] },
      include: [
        { model: Utilizador, as: 'cliente', attributes: atribsUtilizador }
      ],
      order: [['data', 'DESC']]
    });

    return res.status(200).json(avaliacoes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function obter(req, res) {
  try {
    const avaliacao = await AvaliacaoFisica.findByPk(req.params.id, {
      attributes: { exclude: ['treinadorId'] },
      include: [
        { model: Utilizador, as: 'cliente', attributes: atribsUtilizador }
      ]
    });

    if (!avaliacao) return res.status(404).json({ erro: 'Avaliação não encontrada.' });

    if (req.user.role === 'cliente' && avaliacao.clienteId !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }
    if (req.user.role === 'treinador') {
      const temPlanoComCliente = await PlanoTreino.count({
        where: { treinadorId: req.user.id, clienteId: avaliacao.clienteId }
      });
      if (temPlanoComCliente === 0) {
        return res.status(403).json({ erro: 'Acesso negado.' });
      }
    }

    return res.status(200).json(avaliacao);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function criar(req, res) {
  const { data, pesoKg, alturaCm, percGordura, notas } = req.body;
  const clienteIdPayload = req.body.clienteId ?? req.body.cliente_id;

  if (!data) {
    return res.status(400).json({ erro: 'data é obrigatória.' });
  }

  try {
    let clienteIdFinal, tipo;

    if (req.user.role === 'cliente') {
      if (clienteIdPayload !== undefined && clienteIdPayload !== null && Number(clienteIdPayload) !== req.user.id) {
        return res.status(403).json({ erro: 'clienteId inválido. Cliente só pode criar avaliação para si próprio.' });
      }
      clienteIdFinal = req.user.id;
      tipo = 'pessoal';
    } else {
      if (!clienteIdPayload) return res.status(400).json({ erro: 'clienteId é obrigatório para treinadores.' });
      const cliente = await Utilizador.findByPk(clienteIdPayload);
      if (!cliente || cliente.role !== 'cliente') {
        return res.status(400).json({ erro: 'clienteId inválido. Deve referenciar um utilizador com role cliente.' });
      }
      if (req.user.role === 'treinador' && Number(clienteIdPayload) === req.user.id) {
        return res.status(400).json({ erro: 'Treinador não pode criar autoavaliações.' });
      }
      if (req.user.role === 'treinador') {
        const planoOutroTreinador = await PlanoTreino.count({
          where: {
            clienteId: Number(clienteIdPayload),
            tipo: 'profissional',
            treinadorId: { [Op.ne]: req.user.id }
          }
        });
        if (planoOutroTreinador > 0) {
          return res.status(403).json({ erro: 'Cliente já está associado a outro treinador.' });
        }
      }
      clienteIdFinal = clienteIdPayload;
      tipo = 'profissional';
    }

    const imc = calcularImc(pesoKg, alturaCm);

    const avaliacao = await AvaliacaoFisica.create({
      clienteId: clienteIdFinal,
      treinadorId: tipo === 'profissional' ? req.user.id : null,
      tipo,
      data,
      pesoKg:      pesoKg      || null,
      alturaCm:    alturaCm    || null,
      percGordura: percGordura || null,
      imc,
      notas:       notas       || null
    });

    return res.status(201).json({ mensagem: 'Avaliação criada com sucesso.', id: avaliacao.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function atualizar(req, res) {
  try {
    const avaliacao = await AvaliacaoFisica.findByPk(req.params.id);
    if (!avaliacao) return res.status(404).json({ erro: 'Avaliação não encontrada.' });

    if (req.user.role === 'cliente') {
      if (avaliacao.clienteId !== req.user.id || avaliacao.tipo !== 'pessoal') {
        return res.status(403).json({ erro: 'Cliente só pode atualizar avaliações pessoais próprias.' });
      }
    } else if (req.user.role === 'treinador') {
      if (avaliacao.tipo !== 'profissional') {
        return res.status(403).json({ erro: 'Treinador só pode editar avaliações profissionais.' });
      }
      if (avaliacao.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Treinador só pode editar avaliações profissionais do seu âmbito.' });
      }
      const temPlanoComCliente = await PlanoTreino.count({
        where: { treinadorId: req.user.id, clienteId: avaliacao.clienteId }
      });
      if (temPlanoComCliente === 0) {
        return res.status(403).json({ erro: 'Acesso negado.' });
      }
      const planoOutroTreinador = await PlanoTreino.count({
        where: {
          clienteId: avaliacao.clienteId,
          tipo: 'profissional',
          treinadorId: { [Op.ne]: req.user.id }
        }
      });
      if (planoOutroTreinador > 0) {
        return res.status(403).json({ erro: 'Cliente está associado a outro treinador.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const { data, pesoKg, alturaCm, percGordura, notas } = req.body;
    const novoImc = calcularImc(
      pesoKg   ?? avaliacao.pesoKg,
      alturaCm ?? avaliacao.alturaCm
    );

    await avaliacao.update({
      data:        data        ?? avaliacao.data,
      pesoKg:      pesoKg      ?? avaliacao.pesoKg,
      alturaCm:    alturaCm    ?? avaliacao.alturaCm,
      percGordura: percGordura ?? avaliacao.percGordura,
      imc:         novoImc,
      notas:       notas       ?? avaliacao.notas
    });

    return res.status(200).json({ mensagem: 'Avaliação atualizada com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function apagar(req, res) {
  try {
    const avaliacao = await AvaliacaoFisica.findByPk(req.params.id);
    if (!avaliacao) return res.status(404).json({ erro: 'Avaliação não encontrada.' });

    if (req.user.role === 'cliente') {
      if (avaliacao.clienteId !== req.user.id || avaliacao.tipo !== 'pessoal') {
        return res.status(403).json({ erro: 'Cliente só pode apagar avaliações pessoais próprias.' });
      }
    } else if (req.user.role === 'treinador') {
      if (avaliacao.tipo !== 'profissional') {
        return res.status(403).json({ erro: 'Treinador só pode apagar avaliações profissionais.' });
      }
      if (avaliacao.treinadorId !== req.user.id) {
        return res.status(403).json({ erro: 'Treinador só pode apagar avaliações profissionais do seu âmbito.' });
      }
      const temPlanoComCliente = await PlanoTreino.count({
        where: { treinadorId: req.user.id, clienteId: avaliacao.clienteId }
      });
      if (temPlanoComCliente === 0) {
        return res.status(403).json({ erro: 'Acesso negado.' });
      }
      const planoOutroTreinador = await PlanoTreino.count({
        where: {
          clienteId: avaliacao.clienteId,
          tipo: 'profissional',
          treinadorId: { [Op.ne]: req.user.id }
        }
      });
      if (planoOutroTreinador > 0) {
        return res.status(403).json({ erro: 'Cliente está associado a outro treinador.' });
      }
    }

    await avaliacao.destroy();
    return res.status(200).json({ mensagem: 'Avaliação apagada com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { listar, obter, criar, atualizar, apagar };
