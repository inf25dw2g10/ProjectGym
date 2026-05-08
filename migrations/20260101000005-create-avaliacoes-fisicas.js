'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('avaliacoes_fisicas', {
      id: {
        type:          Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey:    true
      },
      cliente_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'utilizadores', key: 'id' }
      },
      treinador_id: {
        type:       Sequelize.INTEGER,
        allowNull:  true,
        references: { model: 'utilizadores', key: 'id' }
      },
      tipo: {
        type:      Sequelize.ENUM('pessoal', 'profissional'),
        allowNull: false
      },
      data: {
        type:      Sequelize.DATEONLY,
        allowNull: false
      },
      peso_kg: {
        type:      Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      altura_cm: {
        type:      Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      perc_gordura: {
        type:      Sequelize.DECIMAL(4, 2),
        allowNull: true
      },
      imc: {
        type:      Sequelize.DECIMAL(4, 2),
        allowNull: true
      },
      notas: {
        type:      Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type:      Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type:      Sequelize.DATE,
        allowNull: false
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('avaliacoes_fisicas');
  }
};
