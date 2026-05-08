'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('planos_treino', {
      id: {
        type:          Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey:    true
      },
      titulo: {
        type:      Sequelize.STRING(150),
        allowNull: false
      },
      descricao: {
        type:      Sequelize.TEXT,
        allowNull: true
      },
      objetivo: {
        type:      Sequelize.ENUM('emagrecimento', 'hipertrofia', 'resistencia', 'flexibilidade', 'saude_geral'),
        allowNull: false
      },
      duracao_sem: {
        type:      Sequelize.INTEGER,
        allowNull: false
      },
      tipo: {
        type:         Sequelize.ENUM('pessoal', 'profissional'),
        allowNull:    false,
        defaultValue: 'profissional'
      },
      treinador_id: {
        type:       Sequelize.INTEGER,
        allowNull:  true,
        references: { model: 'utilizadores', key: 'id' }
      },
      cliente_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'utilizadores', key: 'id' }
      },
      ativo: {
        type:         Sequelize.BOOLEAN,
        defaultValue: true
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
    await queryInterface.dropTable('planos_treino');
  }
};
