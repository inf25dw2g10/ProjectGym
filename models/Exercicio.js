
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exercicio = sequelize.define('Exercicio', {
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
  nome: {
    type:      DataTypes.STRING(100),
    allowNull: false
  },
  grupoMuscular: {
    type:      DataTypes.STRING(80),
    allowNull: false,
    field:     'grupo_muscular'
  },
  series: {
    type:      DataTypes.INTEGER,
    allowNull: false
  },
  reps: {
    type:      DataTypes.INTEGER,
    allowNull: false
  },
  pesoKg: {
    type:      DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field:     'peso_kg'
  },
  notas: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  ordem: {
    type:         DataTypes.INTEGER,
    allowNull:    false,
    defaultValue: 1
  }
}, {
  tableName:   'exercicios',
  timestamps:  false,
  underscored: true
});

module.exports = Exercicio;
