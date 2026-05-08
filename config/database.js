const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME     || 'project_gym',
  process.env.DB_USER     || 'gymuser',
  process.env.DB_PASSWORD || 'gympass1234',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false
  }
);

module.exports = sequelize;
