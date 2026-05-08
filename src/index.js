require('dotenv').config();

const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const session    = require('express-session');
const swaggerUi  = require('swagger-ui-express');
const YAML       = require('yamljs');
const path       = require('path');

const { passport } = require('./controllers/authController');
const { sequelize } = require('../models');

const authRoutes        = require('./routes/auth');
const planosRoutes      = require('./routes/planos');
const exerciciosRoutes  = require('./routes/exercicios');
const sessoesRoutes     = require('./routes/sessoes');
const usersRoutes       = require('./routes/users');
const avaliacoesRoutes  = require('./routes/avaliacoes');
const metasRoutes       = require('./routes/metas');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'project_gym_session_secret',
  resave:            false,
  saveUninitialized: false,
  cookie:            { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

const swaggerDoc = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get('/openapi.json', (req, res) => {
  res.json(swaggerDoc);
});

app.get('/login', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/login.html'))
);

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  }
  res.redirect('/login');
});

app.use('/auth',        authRoutes);
app.use('/planos',      planosRoutes);
app.use('/exercicios',  exerciciosRoutes);
app.use('/sessoes',     sessoesRoutes);
app.use('/users',       usersRoutes);
app.use('/avaliacoes',  avaliacoesRoutes);
app.use('/metas',       metasRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

sequelize.authenticate()
  .then(() => {
    console.log('Ligado à base de dados.');
    app.listen(PORT, () => {
      console.log('╔══════════════════════════════════════════╗');
      console.log(`║  Project Gym API - porta ${PORT}            ║`);
      console.log(`║  Docs : http://localhost:${PORT}/docs        ║`);
      console.log(`║  Login: http://localhost:${PORT}/login       ║`);
      console.log('╚══════════════════════════════════════════╝');
    });
  })
  .catch(err => {
    console.error('Erro ao ligar à base de dados:', err);
    process.exit(1);
  });
