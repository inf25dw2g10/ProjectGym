'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('utilizadores', {
      id: {
        type:          Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey:    true
      },
      provider_id: {
        type:      Sequelize.STRING(100),
        allowNull: false,
        unique:    true
      },
      provider: {
        type:         Sequelize.ENUM('github', 'google', 'basic'),
        allowNull:    false,
        defaultValue: 'basic'
      },
      username: {
        type:      Sequelize.STRING(100),
        allowNull: false
      },
      display_name: {
        type:      Sequelize.STRING(150),
        allowNull: true
      },
      email: {
        type:      Sequelize.STRING(200),
        allowNull: true
      },
      password_hash: {
        type:      Sequelize.STRING(255),
        allowNull: true
      },
      avatar_url: {
        type:      Sequelize.STRING(500),
        allowNull: true
      },
      api_key: {
        type:      Sequelize.STRING(64),
        allowNull: true,
        unique:    true
      },
      role: {
        type:         Sequelize.ENUM('admin', 'treinador', 'cliente'),
        allowNull:    false,
        defaultValue: 'cliente'
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
    await queryInterface.dropTable('utilizadores');
  }
};
