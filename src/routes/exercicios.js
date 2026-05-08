
const express = require('express');
const router  = express.Router();
const { ensureAnyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/exerciciosController');

router.get('/',    ensureAnyAuth, ctrl.listar);
router.get('/:id', ensureAnyAuth, ctrl.obter);
router.post('/',   ensureAnyAuth, ctrl.criar);
router.put('/:id', ensureAnyAuth, ctrl.atualizar);   
router.delete('/:id', ensureAnyAuth, ctrl.apagar);

module.exports = router;
