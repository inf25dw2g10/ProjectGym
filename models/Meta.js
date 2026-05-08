
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Meta = sequelize.define('Meta', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  clienteId: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    field:     'cliente_id'
  },
  planoId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
    field:     'plano_id'
  },
  tipo: {
    type:      DataTypes.ENUM('pessoal', 'profissional'),
    allowNull: false
  },
  descricao: {
    type:      DataTypes.STRING(255),
    allowNull: false
  },
  valorAlvo: {
    type:      DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field:     'valor_alvo'
  },
  valorAtual: {
    type:         DataTypes.DECIMAL(8, 2),
    allowNull:    true,
    defaultValue: 0,
    field:        'valor_atual'
  },
  unidade: {
    type:      DataTypes.STRING(20),
    allowNull: true
  },
  prazo: {
    type:      DataTypes.DATEONLY,
    allowNull: true
  },
  estado: {
    type:         DataTypes.ENUM('ativa', 'concluida', 'cancelada'),
    allowNull:    false,
    defaultValue: 'ativa'
  }
}, {
  tableName:   'metas',
  timestamps:  true,
  underscored: true
});

module.exports = Meta;
