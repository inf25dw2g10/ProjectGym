/* 
Os ficheiros *seed* foram criados com IA de maneira a preencher com dados a estrutura dada. Exemplo de prompt: "gera dados aleatórios de modo a preencher os campos apresentados."
*/

'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const utilizadores = await queryInterface.sequelize.query(
      'SELECT id, role FROM utilizadores ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );
    const treinadores = utilizadores.filter((u) => u.role === 'treinador').map((u) => u.id);
    const clientes = utilizadores.filter((u) => u.role === 'cliente').map((u) => u.id);
    const objetivos = ['emagrecimento', 'hipertrofia', 'resistencia', 'flexibilidade', 'saude_geral'];
    const clientesSemProfissional = new Set(clientes.slice(0, 2));

    const planos = [];

    clientes.forEach((clienteId, index) => {
      const objetivo = objetivos[index % objetivos.length];
      const treinadorId = treinadores[index % treinadores.length];
      const semPlanoProfissional = clientesSemProfissional.has(clienteId);

      if (!semPlanoProfissional) {
        planos.push({
          titulo: `Plano Profissional C${clienteId}`,
          descricao: `Plano orientado para ${objetivo} com progressao semanal.`,
          objetivo,
          duracao_sem: 8 + (index % 8) * 2,
          tipo: 'profissional',
          treinador_id: treinadorId,
          cliente_id: clienteId,
          ativo: true,
          created_at: now,
          updated_at: now
        });
      }

      if (index % 3 === 0 || semPlanoProfissional) {
        planos.push({
          titulo: `Plano Pessoal C${clienteId}`,
          descricao: 'Plano autonomo para complementar treino semanal.',
          objetivo: objetivos[(index + 2) % objetivos.length],
          duracao_sem: 4 + (index % 4) * 2,
          tipo: 'pessoal',
          treinador_id: null,
          cliente_id: clienteId,
          ativo: true,
          created_at: now,
          updated_at: now
        });
      }
    });

    await queryInterface.bulkInsert('planos_treino', planos);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('planos_treino', null, {});
  }
};
