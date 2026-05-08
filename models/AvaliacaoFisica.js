
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AvaliacaoFisica = sequelize.define('AvaliacaoFisica', {
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

  treinadorId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
    field:     'treinador_id'
  },
  tipo: {
    type:      DataTypes.ENUM('pessoal', 'profissional'),
    allowNull: false
  },
  data: {
    type:      DataTypes.DATEONLY,
    allowNull: false
  },
  pesoKg: {
    type:      DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field:     'peso_kg'
  },
  alturaCm: {
    type:      DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field:     'altura_cm'
  },
  percGordura: {
    type:      DataTypes.DECIMAL(4, 2),
    allowNull: true,
    field:     'perc_gordura'
  },
  imc: {
    type:      DataTypes.DECIMAL(4, 2),
    allowNull: true
  },
  notas: {
    type:      DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName:   'avaliacoes_fisicas',
  timestamps:  true,
  underscored: true
});

module.exports = AvaliacaoFisica;
