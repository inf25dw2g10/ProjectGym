/* 
Os ficheiros *seed* foram criados com IA de maneira a preencher com dados a estrutura dada. Exemplo de prompt: "gera dados aleatórios de modo a preencher os campos apresentados."
*/

'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const d = (offset) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + offset);
      return dt.toISOString().split('T')[0];
    };

    const planos = await queryInterface.sequelize.query(
      'SELECT id, cliente_id, treinador_id, tipo FROM planos_treino ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );

    const sessoes = [];

    planos.forEach((plano, index) => {
      if (plano.tipo === 'profissional' && plano.treinador_id) {
        sessoes.push({
          plano_id: plano.id,
          cliente_id: plano.cliente_id,
          treinador_id: plano.treinador_id,
          data_sessao: d(-14 - (index % 9)),
          duracao_min: 50 + (index % 5) * 10,
          notas: 'Sessao concluida com progressao positiva.',
          estado: 'concluida'
        });
        sessoes.push({
          plano_id: plano.id,
          cliente_id: plano.cliente_id,
          treinador_id: plano.treinador_id,
          data_sessao: d(5 + (index % 12)),
          duracao_min: 50 + (index % 4) * 15,
          notas: 'Sessao futura para continuidade do bloco.',
          estado: 'agendada'
        });
      }
    });

    await queryInterface.bulkInsert('sessoes', sessoes);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('sessoes', null, {});
  }
};
