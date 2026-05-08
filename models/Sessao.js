
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sessao = sequelize.define('Sessao', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  planoId: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    field:     'plano_id'
  },
  clienteId: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    field:     'cliente_id'
  },
  treinadorId: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    field:     'treinador_id'
  },
  dataSessao: {
    type:      DataTypes.DATEONLY,
    allowNull: false,
    field:     'data_sessao'
  },
  duracaoMin: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    field:     'duracao_min'
  },
  notas: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  estado: {
    type:         DataTypes.ENUM('agendada', 'concluida', 'cancelada'),
    defaultValue: 'agendada'
  }
}, {
  tableName:   'sessoes',
  timestamps:  false,
  underscored: true
});

module.exports = Sessao;
