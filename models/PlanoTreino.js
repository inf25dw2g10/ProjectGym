
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlanoTreino = sequelize.define('PlanoTreino', {
  id: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true
  },
  titulo: {
    type:      DataTypes.STRING(150),
    allowNull: false
  },
  descricao: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  objetivo: {
    type:      DataTypes.ENUM('emagrecimento', 'hipertrofia', 'resistencia', 'flexibilidade', 'saude_geral'),
    allowNull: false
  },
  duracaoSem: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    field:     'duracao_sem'
  },
  tipo: {
    type:         DataTypes.ENUM('pessoal', 'profissional'),
    allowNull:    false,
    defaultValue: 'profissional'
  },
  treinadorId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
    field:     'treinador_id'
  },
  clienteId: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    field:     'cliente_id'
  },
  ativo: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName:   'planos_treino',
  timestamps:  true,
  underscored: true
});

module.exports = PlanoTreino;
