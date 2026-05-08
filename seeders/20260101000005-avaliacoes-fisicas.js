/* 
Os ficheiros *seed* foram criados com IA de maneira a preencher com dados a estrutura dada. Exemplo de prompt: "gera dados aleatórios de modo a preencher os campos apresentados."
*/

'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const d   = (offset) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return dt.toISOString().split('T')[0];
    };
    const imc = (peso, altura) => parseFloat((peso / Math.pow(altura / 100, 2)).toFixed(2));

    const planos = await queryInterface.sequelize.query(
      'SELECT id, cliente_id, treinador_id, tipo FROM planos_treino WHERE tipo = \'profissional\' ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );
    const clientesComPlano = new Set(planos.map((p) => p.cliente_id));
    const clientesTodos = await queryInterface.sequelize.query(
      'SELECT id FROM utilizadores WHERE role = \'cliente\' ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );
    const avaliacoes = [];

    planos.forEach((plano, index) => {
      const altura = 155 + (index % 30);
      const pesoBase = 52 + (index % 45);
      const pesoAtual = Number((pesoBase - ((index % 6) * 0.7)).toFixed(2));

      avaliacoes.push({
        cliente_id: plano.cliente_id,
        treinador_id: plano.treinador_id,
        tipo: 'profissional',
        data: d(-45 - (index % 20)),
        peso_kg: pesoBase,
        altura_cm: altura,
        perc_gordura: Number((14 + (index % 18) * 0.8).toFixed(2)),
        imc: imc(pesoBase, altura),
        notas: 'Avaliacao inicial com treinador.',
        created_at: now,
        updated_at: now
      });
      avaliacoes.push({
        cliente_id: plano.cliente_id,
        treinador_id: plano.treinador_id,
        tipo: 'profissional',
        data: d(-10 - (index % 10)),
        peso_kg: pesoAtual,
        altura_cm: altura,
        perc_gordura: Number((13 + (index % 16) * 0.7).toFixed(2)),
        imc: imc(pesoAtual, altura),
        notas: 'Avaliacao de acompanhamento.',
        created_at: now,
        updated_at: now
      });
    });

    clientesTodos.forEach(({ id: clienteId }, index) => {
      if (!clientesComPlano.has(clienteId)) {
        const altura = 160 + (index % 20);
        const peso = Number((58 + (index % 30) * 0.9).toFixed(2));

        avaliacoes.push({
          cliente_id: clienteId,
          treinador_id: null,
          tipo: 'pessoal',
          data: d(-8 - (index % 12)),
          peso_kg: peso,
          altura_cm: altura,
          perc_gordura: null,
          imc: imc(peso, altura),
          notas: 'Auto-avaliacao pessoal.',
          created_at: now,
          updated_at: now
        });
      }
    });

    await queryInterface.bulkInsert('avaliacoes_fisicas', avaliacoes);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('avaliacoes_fisicas', null, {});
  }
};
