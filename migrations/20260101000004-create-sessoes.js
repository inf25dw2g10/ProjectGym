'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sessoes', {
      id: {
        type:          Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey:    true
      },
      plano_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'planos_treino', key: 'id' }
      },
      cliente_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'utilizadores', key: 'id' }
      },
      treinador_id: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: 'utilizadores', key: 'id' }
      },
      data_sessao: {
        type:      Sequelize.DATEONLY,
        allowNull: false
      },
      duracao_min: {
        type:      Sequelize.INTEGER,
        allowNull: false
      },
      notas: {
        type:      Sequelize.TEXT,
        allowNull: true
      },
      estado: {
        type:         Sequelize.ENUM('agendada', 'concluida', 'cancelada'),
        defaultValue: 'agendada'
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sessoes');
  }
};
