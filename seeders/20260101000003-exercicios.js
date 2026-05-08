/* 
Os ficheiros *seed* foram criados com IA de maneira a preencher com dados a estrutura dada. Exemplo de prompt: "gera dados aleatórios de modo a preencher os campos apresentados."
*/

'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const modelos = {
      emagrecimento: [
        ['Corrida intervalada', 'Cardio', 1, 1, null, '25 min em blocos 2:1'],
        ['Agachamento goblet', 'Quadriceps', 4, 12, 18, null],
        ['Remo sentado', 'Costas', 4, 12, 35, null],
        ['Prancha frontal', 'Core', 3, 1, null, '45 segundos por serie']
      ],
      hipertrofia: [
        ['Supino reto', 'Peitoral', 5, 8, 70, 'Aumentar 2.5kg a cada 2 semanas'],
        ['Levantamento terra', 'Costas', 5, 5, 95, null],
        ['Desenvolvimento militar', 'Ombros', 4, 10, 35, null],
        ['Rosca direta', 'Biceps', 4, 12, 22.5, null]
      ],
      resistencia: [
        ['Corrida continua', 'Cardio', 1, 1, null, '40-70 min zona 2'],
        ['Burpee', 'Full Body', 4, 15, null, null],
        ['Bike ergometrica', 'Cardio', 1, 1, null, '30 min intensidade moderada'],
        ['Step up', 'Quadriceps', 3, 14, 10, 'Alternar pernas']
      ],
      flexibilidade: [
        ['Alongamento de cadeia posterior', 'Isquiotibiais', 3, 1, null, '30-45 segundos'],
        ['Mobilidade toracica', 'Core', 3, 12, null, null],
        ['Yoga saudacao ao sol', 'Full Body', 3, 6, null, null],
        ['Ponte de gluteos', 'Gluteos', 3, 15, null, 'Controle de movimento']
      ],
      saude_geral: [
        ['Caminhada inclinada', 'Cardio', 1, 1, null, '20-35 min'],
        ['Leg press', 'Quadriceps', 3, 12, 60, null],
        ['Puxada frontal', 'Costas', 3, 12, 40, null],
        ['Prancha lateral', 'Core', 3, 1, null, '30 segundos por lado']
      ]
    };

    const exercicios = [];
    const planos = await queryInterface.sequelize.query(
      'SELECT id, objetivo FROM planos_treino ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );

    planos.forEach(({ id: planoId, objetivo }, idx) => {
      const base = modelos[objetivo];
      const variacao = (planoId % 3) + 1;

      base.forEach(([nome, grupo, series, reps, peso, notas], index) => {
        exercicios.push({
          plano_id: planoId,
          nome: `${nome} - P${planoId}`,
          grupo_muscular: grupo,
          series: Math.max(1, series + (index === 0 ? 0 : variacao - 1)),
          reps,
          peso_kg: peso === null ? null : Number((peso + (planoId % 4) * 2.5).toFixed(2)),
          notas: notas || `Bloco ${idx + 1} foco ${objetivo}`,
          ordem: index + 1
        });
      });
    });

    await queryInterface.bulkInsert('exercicios', exercicios);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('exercicios', null, {});
  }
};
