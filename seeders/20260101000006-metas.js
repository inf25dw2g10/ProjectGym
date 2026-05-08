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

    const planos = await queryInterface.sequelize.query(
      'SELECT id, cliente_id, treinador_id, tipo, objetivo FROM planos_treino ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );

    const metas = [];

    planos.forEach((plano, index) => {
      const profissional = plano.tipo === 'profissional' && plano.treinador_id;
      const tipoMeta = profissional ? 'profissional' : 'pessoal';
      const unidade = plano.objetivo === 'resistencia' ? 'km' : plano.objetivo === 'hipertrofia' ? 'kg' : '%';
      const alvo = plano.objetivo === 'resistencia' ? 10 + (index % 8) : plano.objetivo === 'hipertrofia' ? 80 + (index % 25) : 12 + (index % 10);
      const atual = Number((alvo * (0.35 + (index % 4) * 0.12)).toFixed(2));

      metas.push({
        cliente_id: plano.cliente_id,
        plano_id: plano.id,
        tipo: tipoMeta,
        descricao: `Meta principal de ${plano.objetivo}`,
        valor_alvo: alvo,
        valor_atual: atual,
        unidade,
        prazo: d(45 + (index % 6) * 20),
        estado: index % 11 === 0 ? 'concluida' : 'ativa',
        created_at: now,
        updated_at: now
      });
      metas.push({
        cliente_id: plano.cliente_id,
        plano_id: plano.id,
        tipo: tipoMeta,
        descricao: 'Meta de consistencia semanal',
        valor_alvo: 4,
        valor_atual: Number((2 + (index % 3) * 0.5).toFixed(2)),
        unidade: 'dias',
        prazo: d(30 + (index % 5) * 15),
        estado: 'ativa',
        created_at: now,
        updated_at: now
      });
    });

    await queryInterface.bulkInsert('metas', metas);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('metas', null, {});
  }
};
