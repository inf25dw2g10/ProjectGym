require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER     || 'gymuser',
    password: process.env.DB_PASSWORD || 'gympass1234',
    database: process.env.DB_NAME     || 'project_gym',
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    dialect:  'mysql'
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 3306,
    dialect:  'mysql'
  }
};
