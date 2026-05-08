'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('metas', {
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
      plano_id: {
        type:       Sequelize.INTEGER,
        allowNull:  true,
        references: { model: 'planos_treino', key: 'id' }
      },
      tipo: {
        type:      Sequelize.ENUM('pessoal', 'profissional'),
        allowNull: false
      },
      descricao: {
        type:      Sequelize.STRING(255),
        allowNull: false
      },
      valor_alvo: {
        type:      Sequelize.DECIMAL(8, 2),
        allowNull: true
      },
      valor_atual: {
        type:         Sequelize.DECIMAL(8, 2),
        allowNull:    true,
        defaultValue: 0
      },
      unidade: {
        type:      Sequelize.STRING(20),
        allowNull: true
      },
      prazo: {
        type:      Sequelize.DATEONLY,
        allowNull: true
      },
      estado: {
        type:         Sequelize.ENUM('ativa', 'concluida', 'cancelada'),
        allowNull:    false,
        defaultValue: 'ativa'
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
    await queryInterface.dropTable('metas');
  }
};
