
const sequelize       = require('../config/database');
const Utilizador      = require('./Utilizador');
const PlanoTreino     = require('./PlanoTreino');
const Exercicio       = require('./Exercicio');
const Sessao          = require('./Sessao');
const AvaliacaoFisica = require('./AvaliacaoFisica');
const Meta            = require('./Meta');

Utilizador.hasMany(PlanoTreino, { foreignKey: 'treinadorId', as: 'planosComoTreinador' });
PlanoTreino.belongsTo(Utilizador, { foreignKey: 'treinadorId', as: 'treinador' });

Utilizador.hasMany(PlanoTreino, { foreignKey: 'clienteId', as: 'planosComoCliente' });
PlanoTreino.belongsTo(Utilizador, { foreignKey: 'clienteId', as: 'cliente' });

PlanoTreino.hasMany(Exercicio, { foreignKey: 'planoId', as: 'exercicios', onDelete: 'CASCADE' });
Exercicio.belongsTo(PlanoTreino, { foreignKey: 'planoId', as: 'plano' });

PlanoTreino.hasMany(Sessao, { foreignKey: 'planoId', as: 'sessoes' });
Sessao.belongsTo(PlanoTreino, { foreignKey: 'planoId', as: 'plano' });

Utilizador.hasMany(Sessao, { foreignKey: 'clienteId', as: 'sessoesComoCliente' });
Sessao.belongsTo(Utilizador, { foreignKey: 'clienteId', as: 'cliente' });

Utilizador.hasMany(Sessao, { foreignKey: 'treinadorId', as: 'sessoesComoTreinador' });
Sessao.belongsTo(Utilizador, { foreignKey: 'treinadorId', as: 'treinador' });

Utilizador.hasMany(AvaliacaoFisica, { foreignKey: 'clienteId', as: 'avaliacoesComoCliente' });
AvaliacaoFisica.belongsTo(Utilizador, { foreignKey: 'clienteId', as: 'cliente' });

Utilizador.hasMany(AvaliacaoFisica, { foreignKey: 'treinadorId', as: 'avaliacoesComoTreinador' });
AvaliacaoFisica.belongsTo(Utilizador, { foreignKey: 'treinadorId', as: 'treinador' });

Utilizador.hasMany(Meta, { foreignKey: 'clienteId', as: 'metasComoCliente' });
Meta.belongsTo(Utilizador, { foreignKey: 'clienteId', as: 'cliente' });

PlanoTreino.hasMany(Meta, { foreignKey: 'planoId', as: 'metas' });
Meta.belongsTo(PlanoTreino, { foreignKey: 'planoId', as: 'plano' });

module.exports = { sequelize, Utilizador, PlanoTreino, Exercicio, Sessao, AvaliacaoFisica, Meta };
