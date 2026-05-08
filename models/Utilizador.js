
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Utilizador = sequelize.define('Utilizador', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  providerId: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    unique:    true,
    field:     'provider_id'
  },
  provider: {
    type:         DataTypes.ENUM('github', 'google', 'basic'),
    allowNull:    false,
    defaultValue: 'github'
  },
  username: {
    type:      DataTypes.STRING(100),
    allowNull: false
  },
  displayName: {
    type:      DataTypes.STRING(150),
    allowNull: true,
    field:     'display_name'
  },
  email: {
    type:      DataTypes.STRING(200),
    allowNull: true
  },
  passwordHash: {
    type:      DataTypes.STRING(255),
    allowNull: true,
    field:     'password_hash'
  },
  avatarUrl: {
    type:      DataTypes.STRING(500),
    allowNull: true,
    field:     'avatar_url'
  },
  apiKey: {
    type:      DataTypes.STRING(64),
    allowNull: true,
    unique:    true,
    field:     'api_key'
  },
  role: {
    type:         DataTypes.ENUM('admin', 'treinador', 'cliente'),
    allowNull:    false,
    defaultValue: 'cliente'
  }
}, {
  tableName:   'utilizadores',
  timestamps:  true,
  underscored: true
});

module.exports = Utilizador;
