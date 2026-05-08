'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('exercicios', {
      id: {
        type:          Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey:    true
      },
      plano_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'planos_treino', key: 'id' },
        onDelete:   'CASCADE'
      },
      nome: {
        type:      Sequelize.STRING(100),
        allowNull: false
      },
      grupo_muscular: {
        type:      Sequelize.STRING(80),
        allowNull: false
      },
      series: {
        type:      Sequelize.INTEGER,
        allowNull: false
      },
      reps: {
        type:      Sequelize.INTEGER,
        allowNull: false
      },
      peso_kg: {
        type:      Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      notas: {
        type:      Sequelize.TEXT,
        allowNull: true
      },
      ordem: {
        type:         Sequelize.INTEGER,
        allowNull:    false,
        defaultValue: 1
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('exercicios');
  }
};
