
const express = require('express');
const router  = express.Router();
const { ensureAnyAuth, ensureRole } = require('../middleware/auth');
const ctrl = require('../controllers/sessoesController');

router.get('/',    ensureAnyAuth, ctrl.listar);
router.get('/:id', ensureAnyAuth, ctrl.obter);
router.post('/',   ensureAnyAuth, ensureRole('admin', 'treinador'), ctrl.criar);
router.put('/:id', ensureAnyAuth, ctrl.atualizar);
router.delete('/:id', ensureAnyAuth, ensureRole('admin', 'treinador'), ctrl.apagar);

module.exports = router;
