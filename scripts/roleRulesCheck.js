/* IA DISCLAIMER
Foi utilizado IA para a construção do script de testes. Exemplo de prompt: Cria um script que cobre todas as regras de autorização para esta API
Foi utilizado IA para a construção de elementos decorativos, como o dashboard e a página /login. Exemplo de prompt: Cria um dashboard e uma página de login simples com tema escuro para esta API, que inclua os diferentes tipos de autenticação
Foi utilizado IA para a construção da base de dados e preenchimento das mesmas. Exemplo de prompt: Gera uma base de dados e preenche-os com dados aleatórios para esta API
Por fim também usamos IA para fins de debugging, compreensão  e aprimoramento em pequenos detalhes do projeto
*/

/* eslint-disable no-console */

const API = process.env.API_BASE || 'http://localhost:3000';

const TODAY = new Date().toISOString().slice(0, 10);

const TS = Date.now();

const VERBOSE = process.env.TEST_ROLES_VERBOSE === '1';

const results = [];

const cleanup = [];

async function req(path, { method = 'GET', apiKey, body, headers = {} } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let json = null;
  try {
    json = await response.json();
  } catch (_) {
    json = null;
  }

  const setCookie = response.headers.get('set-cookie');

  // setCookie é usado nos testes de logout por sessão.
  return { status: response.status, json, setCookie };
}

async function waitForApi(timeoutMs = 90_000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {

      const r = await req('/openapi.json');
      if (r.status === 200) return true;
    } catch (_) {

    }
    if (Date.now() - start > timeoutMs) return false;

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

function addResult({
  area,
  label,
  ok,
  expected,
  got,
  request,
  response,
  skipped = false,
  reason
}) {
  results.push({
    area,
    label,
    status: skipped ? 'skip' : ok ? 'pass' : 'fail',
    expected,
    got,
    request,
    response,
    reason
  });
}

function expect(area, label, ok, expected, got, response) {
  addResult({ area, label, ok, expected, got, response });
}

function expectStatus(area, label, result, expected, request) {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const ok = expectedList.includes(result.status);
  addResult({
    area,
    label,
    ok,
    expected: expectedList.join('/'),
    got: String(result.status),
    request,
    response: result.json
  });
}

function skip(area, label, reason) {
  addResult({
    area,
    label,
    ok: true,
    skipped: true,
    expected: 'executado',
    got: 'skip',
    reason
  });
}

async function login(usernameOrEmail, password) {
  const result = await req('/auth/login', {
    method: 'POST',
    body: { usernameOrEmail, password }
  });
  if (result.status !== 200 || !result.json?.apiKey) {
    throw new Error(`Falha no login de ${usernameOrEmail}: ${result.status} ${JSON.stringify(result.json)}`);
  }
  return result.json;
}

async function loginWithSession(usernameOrEmail, password) {
  const result = await req('/auth/login', {
    method: 'POST',
    body: { usernameOrEmail, password }
  });

  const sessionCookie = result.setCookie
    ? result.setCookie.split(';')[0]
    : null;

  return { ...result, sessionCookie };
}

function randEmail(prefix) {
  return `${prefix}_${TS}@gym.local`;
}

function onlyIds(arr) {
  return Array.isArray(arr) ? arr.map((x) => x?.id).filter(Boolean) : [];
}

function hasAll(items, predicate) {
  if (!Array.isArray(items)) return false;
  return items.every(predicate);
}

function canonicalizePath(path) {
  if (!path) return '';
  const noQuery = String(path).split('?')[0];
  return noQuery.replace(/\/\d+/g, '/{id}');
}

async function createBasicUserViaRegister({ emailPrefix, usernamePrefix, password = 'password123' }) {
  const email = randEmail(emailPrefix);
  const username = `${usernamePrefix}_${TS}`;
  const reg = await req('/auth/register', {
    method: 'POST',
    body: { email, password, username }
  });
  return { reg, email, username, password };
}

async function withCase(area, label, fn) {
  try {
    await fn();
  } catch (err) {
    // Erro inesperado vira fail do caso, sem parar o resto da suite.
    addResult({
      area,
      label,
      ok: false,
      expected: 'sem erro inesperado',
      got: 'erro',
      response: { erro: err.message }
    });
  }
}

function registerCleanup(description, fn) {
  cleanup.push({ description, fn });
}

async function runCleanup() {
  for (let i = cleanup.length - 1; i >= 0; i -= 1) {
    try {
      await cleanup[i].fn();
    } catch (err) {
      console.warn(`[cleanup] ${cleanup[i].description}: ${err.message}`);
    }
  }
}

async function main() {

  console.log(`[roleRulesCheck] API_BASE=${API}`);

  const apiUp = await waitForApi();
  if (!apiUp) {
    throw new Error('API não respondeu a tempo (confere docker-compose e porta 3000).');
  }

  const admin = await login('admin', 'admin123');
  const treinador = await login('treinador', 'treinador123');
  const cliente = await login('cliente', 'cliente123');

  async function ensurePlanoProfCliente() {
    const clientePlanosRes = await req('/planos', { apiKey: cliente.apiKey });
    const clientePlanos = Array.isArray(clientePlanosRes.json) ? clientePlanosRes.json : [];
    const existing = clientePlanos.find((p) => p.tipo === 'profissional');
    if (existing) return { planoProfCliente: existing, created: false };

    const createPlano = await req('/planos', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: {
        titulo: `Plano Prof Auto ${TS}`,
        descricao: 'gerado por roleRulesCheck (pré-condição)',
        objetivo: 'saude_geral',
        duracaoSem: 4,
        clienteId: cliente.id
      }
    });

    // Se não der para criar o plano, mantemos o comportamento atual (skip nos casos dependentes).
    if (createPlano.status !== 201 || !createPlano.json?.id) {
      return { planoProfCliente: null, created: false, error: createPlano.json || { status: createPlano.status } };
    }

    const planoId = createPlano.json.id;
    registerCleanup(`apagar plano profissional criado para cliente ${planoId}`, async () => {
      await req(`/planos/${planoId}`, { method: 'DELETE', apiKey: admin.apiKey });
    });

    // Garante ao menos 1 exercício no plano profissional para o caso "Restrições em plano profissional".
    const createEx = await req('/exercicios', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: {
        planoId,
        nome: `Ex Prof Auto ${TS}`,
        grupoMuscular: 'Core',
        series: 3,
        reps: 12,
        pesoKg: 10,
        notas: 'pré-condição roleRulesCheck',
        ordem: 1
      }
    });
    if (createEx.status === 201 && createEx.json?.id) {
      const exId = createEx.json.id;
      registerCleanup(`apagar exercicio pré-condição ${exId}`, async () => {
        await req(`/exercicios/${exId}`, { method: 'DELETE', apiKey: admin.apiKey });
      });
    }

    const afterRes = await req('/planos', { apiKey: cliente.apiKey });
    const after = Array.isArray(afterRes.json) ? afterRes.json : [];
    const found = after.find((p) => p.tipo === 'profissional' && Number(p.id) === Number(planoId));
    return { planoProfCliente: found || { id: planoId, tipo: 'profissional' }, created: true };
  }

  // Descobre dados base para usar nos cenários sem hardcode de IDs.
  const adminUsersRes = await req('/users', { apiKey: admin.apiKey });
  const allUsers = Array.isArray(adminUsersRes.json) ? adminUsersRes.json : [];
  const otherClient = allUsers.find((u) => u.role === 'cliente' && u.id !== cliente.id);
  const otherTrainer = allUsers.find((u) => u.role === 'treinador' && u.id !== treinador.id);

  const clientePlanosRes = await req('/planos', { apiKey: cliente.apiKey });
  const clientePlanos = Array.isArray(clientePlanosRes.json) ? clientePlanosRes.json : [];
  const planoPessoalCliente = clientePlanos.find((p) => p.tipo === 'pessoal');
  let planoProfCliente = clientePlanos.find((p) => p.tipo === 'profissional');

  if (!planoProfCliente) {
    const ensured = await ensurePlanoProfCliente();
    planoProfCliente = ensured.planoProfCliente;
  }

  const treinadorPlanosRes = await req('/planos', { apiKey: treinador.apiKey });
  const treinadorPlanos = Array.isArray(treinadorPlanosRes.json) ? treinadorPlanosRes.json : [];
  const planoTreinador = treinadorPlanos.find((p) => p.tipo === 'profissional' && p.treinadorId === treinador.id);
  const adminPlanosRes = await req('/planos', { apiKey: admin.apiKey });
  const adminPlanos = Array.isArray(adminPlanosRes.json) ? adminPlanosRes.json : [];

  // AUTH: comportamento de login/logout e requests sem autenticação.
  await withCase('auth', 'Pedido sem autenticação deve falhar', async () => {
    const r = await req('/planos');
    expectStatus('auth', 'GET /planos sem auth', r, 401, { method: 'GET', path: '/planos' });
  });

  await withCase('auth', 'POST /auth/login aceita X-API-Key sem body (Swagger)', async () => {
    const r = await req('/auth/login', { method: 'POST', apiKey: admin.apiKey });
    expectStatus('auth', 'POST /auth/login com X-API-Key', r, 200, { method: 'POST', path: '/auth/login' });
    const ok = r.status === 200 && r.json?.apiKey === admin.apiKey && r.json?.id === admin.id;
    expect('auth', '/auth/login retorna o próprio utilizador', ok, 'id/apiKey do próprio utilizador', JSON.stringify(r.json), r.json);
  });

  await withCase('auth', 'POST /auth/login com credenciais válidas retorna 200 e apiKey', async () => {
    const r = await req('/auth/login', {
      method: 'POST',
      body: { usernameOrEmail: 'admin', password: 'admin123' }
    });
    expectStatus('auth', 'POST /auth/login (credenciais válidas)', r, 200, { method: 'POST', path: '/auth/login' });
    const ok = r.status === 200 && !!r.json?.apiKey && !!r.json?.id;
    expect('auth', '/auth/login válido retorna id e apiKey', ok, 'id/apiKey presentes', JSON.stringify(r.json), r.json);
  });

  await withCase('auth', 'POST /auth/login com password inválida retorna 401', async () => {
    const r = await req('/auth/login', {
      method: 'POST',
      body: { usernameOrEmail: 'admin', password: 'password_errada' }
    });
    expectStatus('auth', 'POST /auth/login (password inválida)', r, 401, { method: 'POST', path: '/auth/login' });
  });

  await withCase('auth', 'GET /auth/logout sem sessão autenticada retorna 401', async () => {
    const r = await req('/auth/logout');
    expectStatus('auth', 'GET /auth/logout sem sessão', r, 401, { method: 'GET', path: '/auth/logout' });
  });

  await withCase('auth', 'GET /auth/logout com sessão autenticada retorna 200', async () => {
    const loginRes = await loginWithSession('admin', 'admin123');
    expectStatus('auth', 'Pré-condição login com sessão para logout', loginRes, 200, { method: 'POST', path: '/auth/login' });
    if (!loginRes.sessionCookie) {
      return addResult({
        area: 'auth',
        label: 'Cookie de sessão disponível após login',
        ok: false,
        expected: 'set-cookie com sessão',
        got: 'ausente',
        response: loginRes.json
      });
    }

    const logoutRes = await req('/auth/logout', {
      method: 'GET',
      headers: { Cookie: loginRes.sessionCookie }
    });
    expectStatus('auth', 'GET /auth/logout com sessão', logoutRes, 200, { method: 'GET', path: '/auth/logout' });
  });

  // USERS: visibilidade por role e filtros de cliente/treinador.
  await withCase('users', 'Cliente sem acesso a /users', async () => {
    const r = await req('/users', { apiKey: cliente.apiKey });
    expectStatus('users', 'GET /users (cliente)', r, 403, { method: 'GET', path: '/users' });
  });

  await withCase('users', 'Treinador vê apenas clientes no /users', async () => {
    const r = await req('/users', { apiKey: treinador.apiKey });
    expectStatus('users', 'GET /users (treinador)', r, 200, { method: 'GET', path: '/users' });
    if (r.status === 200 && Array.isArray(r.json)) {

      const onlyClients = r.json.every((u) => u.role === 'cliente');
      addResult({
        area: 'users',
        label: 'Treinador recebe apenas users role=cliente',
        ok: onlyClients,
        expected: 'apenas clientes',
        got: onlyClients ? 'apenas clientes' : 'inclui outros roles',
        response: r.json
      });
    }
  });

  await withCase('users', 'Treinador também vê clientes sem treinador (sem plano profissional)', async () => {

    const { reg } = await createBasicUserViaRegister({
      emailPrefix: 'cliente_sem_plano',
      usernamePrefix: 'cliente_sem_plano'
    });
    expectStatus('users', 'POST /auth/register (cliente sem plano)', reg, 201, { method: 'POST', path: '/auth/register' });
    const newApiKey = reg.json?.apiKey;
    const newId = reg.json?.id;
    if (!newId) return;

    const me = await req('/users/me', { apiKey: newApiKey });
    expectStatus('users', 'GET /users/me (novo cliente)', me, 200, { method: 'GET', path: '/users/me' });

    const listTreinador = await req('/users', { apiKey: treinador.apiKey });
    expectStatus('users', 'GET /users (treinador) inclui cliente sem plano', listTreinador, 200, { method: 'GET', path: '/users' });
    if (listTreinador.status === 200 && Array.isArray(listTreinador.json)) {
      const ids = onlyIds(listTreinador.json);
      const ok = ids.includes(newId);
      expect('users', 'Cliente sem plano aparece no /users do treinador', ok, `conter id=${newId}`, `ids=${ids.join(',')}`, {
        lookedFor: newId,
        returnedCount: ids.length
      });
    }
  });

  await withCase('users', 'Treinador sem clientes atribuídos vê clientes sem plano profissional', async () => {
    const novoTreinador = await createBasicUserViaRegister({
      emailPrefix: 'treinador_sem_clientes',
      usernamePrefix: 'treinador_sem_clientes'
    });
    expectStatus('users', 'POST /auth/register (treinador tmp)', novoTreinador.reg, 201, { method: 'POST', path: '/auth/register' });
    const novoTreinadorId = novoTreinador.reg.json?.id;
    if (!novoTreinadorId) return;

    const promote = await req(`/users/${novoTreinadorId}/role`, {
      method: 'PUT',
      apiKey: admin.apiKey,
      body: { role: 'treinador' }
    });
    expectStatus('users', 'PUT /users/:id/role -> treinador (tmp)', promote, 200, {
      method: 'PUT',
      path: `/users/${novoTreinadorId}/role`
    });
    if (promote.status !== 200) return;

    const novoCliente = await createBasicUserViaRegister({
      emailPrefix: 'cliente_sem_plano_novo',
      usernamePrefix: 'cliente_sem_plano_novo'
    });
    expectStatus('users', 'POST /auth/register (cliente sem plano novo)', novoCliente.reg, 201, { method: 'POST', path: '/auth/register' });
    const novoClienteId = novoCliente.reg.json?.id;
    if (!novoClienteId) return;

    const trainerAuth = await login(novoTreinador.username, novoTreinador.password);
    const listNovoTreinador = await req('/users', { apiKey: trainerAuth.apiKey });
    expectStatus('users', 'GET /users (treinador sem clientes)', listNovoTreinador, 200, { method: 'GET', path: '/users' });
    if (listNovoTreinador.status === 200 && Array.isArray(listNovoTreinador.json)) {
      const ids = onlyIds(listNovoTreinador.json);
      const ok = ids.includes(novoClienteId);
      expect('users', 'Treinador sem clientes vê cliente sem plano profissional', ok, `conter id=${novoClienteId}`, `ids=${ids.join(',')}`, {
        lookedFor: novoClienteId,
        returnedCount: ids.length
      });
    }
  });

  await withCase('users', 'Filtros cliente_id e treinador_id em /users', async () => {
    const listTreinador = await req('/users', { apiKey: treinador.apiKey });
    expectStatus('users', 'GET /users base (treinador) para filtro', listTreinador, 200, { method: 'GET', path: '/users' });
    const allowedClientId = Array.isArray(listTreinador.json) && listTreinador.json[0] ? listTreinador.json[0].id : null;
    if (!allowedClientId) return skip('users', 'Filtros cliente_id e treinador_id em /users', 'Treinador sem clientes visíveis');

    const byClienteTreinador = await req(`/users?cliente_id=${allowedClientId}`, { apiKey: treinador.apiKey });
    expectStatus('users', 'GET /users?cliente_id (treinador)', byClienteTreinador, 200, {
      method: 'GET',
      path: `/users?cliente_id=${allowedClientId}`
    });
    if (byClienteTreinador.status === 200 && Array.isArray(byClienteTreinador.json)) {
      const ok = hasAll(byClienteTreinador.json, (u) => u.id === allowedClientId);
      expect('users', 'Filtro cliente_id (treinador) retorna só esse cliente', ok, `id=${allowedClientId}`, 'misturado', byClienteTreinador.json);
    }

    const trainerFilterDenied = await req(`/users?treinador_id=${treinador.id}`, { apiKey: treinador.apiKey });
    expectStatus('users', 'Treinador não usa filtro treinador_id', trainerFilterDenied, 403, {
      method: 'GET',
      path: `/users?treinador_id=${treinador.id}`
    });

    const byTrainerAdmin = await req(`/users?treinador_id=${treinador.id}`, { apiKey: admin.apiKey });
    expectStatus('users', 'Admin usa filtro treinador_id', byTrainerAdmin, 200, {
      method: 'GET',
      path: `/users?treinador_id=${treinador.id}`
    });
    if (byTrainerAdmin.status === 200 && Array.isArray(byTrainerAdmin.json)) {
      const ok = hasAll(byTrainerAdmin.json, (u) => u.role === 'cliente');
      expect('users', 'Filtro treinador_id retorna apenas clientes', ok, 'apenas role=cliente', 'inclui outros roles', byTrainerAdmin.json);
    }

    const comboAdmin = await req(`/users?treinador_id=${treinador.id}&cliente_id=${allowedClientId}`, { apiKey: admin.apiKey });
    expectStatus('users', 'Admin usa treinador_id + cliente_id', comboAdmin, 200, {
      method: 'GET',
      path: `/users?treinador_id=${treinador.id}&cliente_id=${allowedClientId}`
    });
    if (comboAdmin.status === 200) {
      const ok = hasAll(comboAdmin.json, (u) => u.id === allowedClientId);
      expect('users', 'Combinação treinador_id + cliente_id retorna interseção', ok, `id=${allowedClientId}`, 'misturado', comboAdmin.json);
    }
  });

  await withCase('users', 'Cliente sem acesso a alterar roles', async () => {
    const targetId = otherClient?.id || treinador.id;
    const r = await req(`/users/${targetId}/role`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { role: 'admin' }
    });
    expectStatus('users', 'PUT /users/:id/role (cliente)', r, 403, {
      method: 'PUT',
      path: `/users/${targetId}/role`
    });
  });

  await withCase('users', 'Treinador sem acesso a alterar roles', async () => {
    const targetId = otherClient?.id || cliente.id;
    const r = await req(`/users/${targetId}/role`, {
      method: 'PUT',
      apiKey: treinador.apiKey,
      body: { role: 'admin' }
    });
    expectStatus('users', 'PUT /users/:id/role (treinador)', r, 403, { method: 'PUT', path: `/users/${targetId}/role` });
  });

  await withCase('users', 'Admin consegue alterar role', async () => {
    const { reg } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_promote',
      usernamePrefix: 'tmp_promote'
    });
    expectStatus('users', 'POST /auth/register (tmp)', reg, 201, { method: 'POST', path: '/auth/register' });
    const id = reg.json?.id;
    if (!id) return;
    const promote = await req(`/users/${id}/role`, { method: 'PUT', apiKey: admin.apiKey, body: { role: 'treinador' } });
    expectStatus('users', 'PUT /users/:id/role (admin)', promote, 200, { method: 'PUT', path: `/users/${id}/role` });
  });

  // PLANOS: criação/edição por role e regras de ownership.
  await withCase('planos', 'Cliente cria plano pessoal próprio', async () => {
    const r = await req('/planos', {
      method: 'POST',
      apiKey: cliente.apiKey,
      body: {
        titulo: `Plano Pessoal Auto ${TS}`,
        descricao: 'gerado por roleRulesCheck',
        objetivo: 'saude_geral',
        duracaoSem: 6
      }
    });
    expectStatus('planos', 'POST /planos (cliente)', r, 201, { method: 'POST', path: '/planos' });

    const id = r.json?.id;
    if (id) {

      registerCleanup(`apagar plano cliente ${id}`, async () => {
        await req(`/planos/${id}`, { method: 'DELETE', apiKey: admin.apiKey });
      });

      const getOwn = await req(`/planos/${id}`, { apiKey: cliente.apiKey });
      expectStatus('planos', 'GET /planos/:id criado por cliente', getOwn, 200, { method: 'GET', path: `/planos/${id}` });

      const blockProtectedFields = await req(`/planos/${id}`, {
        method: 'PUT',
        apiKey: cliente.apiKey,
        body: { treinadorId: treinador.id }
      });
      expectStatus('planos', 'Cliente não altera treinadorId no plano', blockProtectedFields, 403, {
        method: 'PUT',
        path: `/planos/${id}`
      });

      if (otherClient) {

        const createWithOtherClientId = await req('/planos', {
          method: 'POST',
          apiKey: cliente.apiKey,
          body: {
            titulo: `Plano inválido ${TS}`,
            objetivo: 'saude_geral',
            duracaoSem: 4,
            clienteId: otherClient.id
          }
        });
        expectStatus('planos', 'Cliente não cria plano para outro cliente', createWithOtherClientId, 403, {
          method: 'POST',
          path: '/planos'
        });
      } else {

        skip('planos', 'Cliente não cria plano para outro cliente', 'Sem outro cliente disponível');
      }
    }
  });

  await withCase('planos', 'Treinador deve informar clienteId ao criar plano', async () => {
    const r = await req('/planos', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: {
        titulo: `Plano Prof sem cliente ${TS}`,
        objetivo: 'hipertrofia',
        duracaoSem: 8
      }
    });
    expectStatus('planos', 'POST /planos (treinador sem clienteId)', r, 400, { method: 'POST', path: '/planos' });
  });

  await withCase('planos', 'Admin cria plano profissional', async () => {
    const { reg } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_client_plan_admin',
      usernamePrefix: 'tmp_client_plan_admin'
    });
    expectStatus('planos', 'Register cliente para plano admin', reg, 201, { method: 'POST', path: '/auth/register' });
    const adminClientId = reg.json?.id;
    if (!adminClientId) return;
    const r = await req('/planos', {
      method: 'POST',
      apiKey: admin.apiKey,
      body: {
        titulo: `Plano Admin ${TS}`,
        objetivo: 'saude_geral',
        duracaoSem: 4,
        clienteId: adminClientId
      }
    });
    expectStatus('planos', 'POST /planos (admin)', r, 201, { method: 'POST', path: '/planos' });
    const id = r.json?.id;
    if (id) registerCleanup(`apagar plano admin ${id}`, async () => req(`/planos/${id}`, { method: 'DELETE', apiKey: admin.apiKey }));
  });

  await withCase('planos', 'Cliente não edita plano profissional', async () => {
    if (!planoProfCliente) return skip('planos', 'Cliente não edita plano profissional', 'Cliente sem plano profissional');
    const r = await req(`/planos/${planoProfCliente.id}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { titulo: `tentativa_${TS}` }
    });
    expectStatus('planos', 'PUT /planos/:id profissional (cliente)', r, 403, { method: 'PUT', path: `/planos/${planoProfCliente.id}` });
  });

  await withCase('planos', 'Treinador não mexe em plano pessoal de cliente', async () => {
    if (!planoPessoalCliente) return skip('planos', 'Treinador não mexe em plano pessoal', 'Cliente sem plano pessoal');
    const r = await req(`/planos/${planoPessoalCliente.id}`, {
      method: 'PUT',
      apiKey: treinador.apiKey,
      body: { titulo: `tentativa_${TS}` }
    });
    expectStatus('planos', 'PUT /planos/:id pessoal (treinador)', r, 403, { method: 'PUT', path: `/planos/${planoPessoalCliente.id}` });
  });

  await withCase('planos', 'Treinador não edita plano de outro treinador', async () => {
    if (!otherTrainer) return skip('planos', 'Bloquear edição de outro treinador', 'Sem outro treinador na seed');
    const planosAdmin = await req('/planos', { apiKey: admin.apiKey });
    const planoOutroTreinador = Array.isArray(planosAdmin.json)
      ? planosAdmin.json.find((p) => p.treinadorId && p.treinadorId !== treinador.id)
      : null;
    if (!planoOutroTreinador) return skip('planos', 'Bloquear edição de outro treinador', 'Sem plano de outro treinador');

    const r = await req(`/planos/${planoOutroTreinador.id}`, {
      method: 'PUT',
      apiKey: treinador.apiKey,
      body: { titulo: `Tentativa indevida ${TS}` }
    });
    expectStatus('planos', 'PUT /planos/:id por treinador externo', r, 403, {
      method: 'PUT',
      path: `/planos/${planoOutroTreinador.id}`
    });
  });

  await withCase('planos', 'Treinador não cria plano para cliente de outro treinador', async () => {

    const { reg: regTrein2 } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_trainer2',
      usernamePrefix: 'tmp_trainer2'
    });
    expectStatus('planos', 'Register treinador2 (tmp)', regTrein2, 201, { method: 'POST', path: '/auth/register' });
    const trainer2Id = regTrein2.json?.id;
    const trainer2Key = regTrein2.json?.apiKey;
    if (!trainer2Id) return;
    const promote = await req(`/users/${trainer2Id}/role`, { method: 'PUT', apiKey: admin.apiKey, body: { role: 'treinador' } });
    expectStatus('planos', 'Promover treinador2', promote, 200, { method: 'PUT', path: `/users/${trainer2Id}/role` });

    const { reg: regClient2 } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_client2',
      usernamePrefix: 'tmp_client2'
    });
    expectStatus('planos', 'Register cliente2', regClient2, 201, { method: 'POST', path: '/auth/register' });
    const client2Id = regClient2.json?.id;
    if (!client2Id) return;

    const p2 = await req('/planos', {
      method: 'POST',
      apiKey: trainer2Key,
      body: { titulo: `P2_${TS}`, objetivo: 'saude_geral', duracaoSem: 4, clienteId: client2Id }
    });
    expectStatus('planos', 'Treinador2 cria plano profissional para cliente2', p2, 201, { method: 'POST', path: '/planos' });
    const p2Id = p2.json?.id;
    if (p2Id) registerCleanup(`apagar plano p2 ${p2Id}`, async () => req(`/planos/${p2Id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    const deny = await req('/planos', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: { titulo: `deny_${TS}`, objetivo: 'saude_geral', duracaoSem: 4, clienteId: client2Id }
    });
    expectStatus('planos', 'Treinador1 não cria plano para cliente de outro treinador', deny, 403, { method: 'POST', path: '/planos' });
  });

  await withCase('planos', 'Filtro cliente_id em /planos respeita permissões', async () => {
    if (!planoTreinador?.clienteId) return skip('planos', 'Filtro cliente_id em /planos', 'Sem cliente associado ao treinador');

    const byClienteAdmin = await req(`/planos?cliente_id=${planoTreinador.clienteId}`, { apiKey: admin.apiKey });
    expectStatus('planos', 'GET /planos?cliente_id (admin)', byClienteAdmin, 200, {
      method: 'GET',
      path: `/planos?cliente_id=${planoTreinador.clienteId}`
    });
    if (byClienteAdmin.status === 200) {
      const ok = hasAll(byClienteAdmin.json, (p) => p.clienteId === planoTreinador.clienteId);
      expect('planos', 'Admin filtra planos por cliente_id', ok, `clienteId=${planoTreinador.clienteId}`, 'misturado', byClienteAdmin.json);
    }

    const byClienteTreinador = await req(`/planos?cliente_id=${planoTreinador.clienteId}`, { apiKey: treinador.apiKey });
    expectStatus('planos', 'GET /planos?cliente_id (treinador)', byClienteTreinador, 200, {
      method: 'GET',
      path: `/planos?cliente_id=${planoTreinador.clienteId}`
    });
    if (byClienteTreinador.status === 200) {
      const ok = hasAll(byClienteTreinador.json, (p) => p.clienteId === planoTreinador.clienteId);
      expect('planos', 'Treinador filtra planos por cliente_id permitido', ok, `clienteId=${planoTreinador.clienteId}`, 'misturado', byClienteTreinador.json);
    }

    const byClienteCliente = await req(`/planos?cliente_id=${cliente.id}`, { apiKey: cliente.apiKey });
    expectStatus('planos', 'Cliente não pode usar filtro cliente_id', byClienteCliente, 403, {
      method: 'GET',
      path: `/planos?cliente_id=${cliente.id}`
    });
  });

  // EXERCICIOS: CRUD por role e filtros ligados ao plano.
  await withCase('exercicios', 'Cliente pode CRUD em plano pessoal próprio', async () => {
    if (!planoPessoalCliente) return skip('exercicios', 'CRUD em plano pessoal', 'Cliente sem plano pessoal');

    const create = await req('/exercicios', {
      method: 'POST',
      apiKey: cliente.apiKey,
      body: {
        planoId: planoPessoalCliente.id,
        nome: `Ex Pessoal ${TS}`,
        grupoMuscular: 'Quadriceps',
        series: 3,
        reps: 12,
        pesoKg: 25,
        notas: 'teste',
        ordem: 50
      }
    });
    expectStatus('exercicios', 'POST /exercicios em plano pessoal próprio', create, 201, { method: 'POST', path: '/exercicios' });
    const exId = create.json?.id;
    if (!exId) return;

    registerCleanup(`apagar exercicio ${exId}`, async () => {
      await req(`/exercicios/${exId}`, { method: 'DELETE', apiKey: admin.apiKey });
    });

    const update = await req(`/exercicios/${exId}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { nome: `Ex Pessoal Editado ${TS}`, grupoMuscular: 'Gluteos', series: 4, reps: 10, ordem: 1 }
    });
    expectStatus('exercicios', 'PUT /exercicios/:id em plano pessoal próprio', update, 200, {
      method: 'PUT',
      path: `/exercicios/${exId}`
    });

    const del = await req(`/exercicios/${exId}`, { method: 'DELETE', apiKey: cliente.apiKey });
    expectStatus('exercicios', 'DELETE /exercicios/:id em plano pessoal próprio', del, 200, {
      method: 'DELETE',
      path: `/exercicios/${exId}`
    });
  });

  await withCase('exercicios', 'Cliente em plano profissional só altera campos permitidos', async () => {
    if (!planoProfCliente) return skip('exercicios', 'Restrições em plano profissional', 'Cliente sem plano profissional');

    const list = await req(`/exercicios?plano_id=${planoProfCliente.id}`, { apiKey: cliente.apiKey });
    expectStatus('exercicios', 'GET /exercicios?plano_id=profissional', list, 200, {
      method: 'GET',
      path: `/exercicios?plano_id=${planoProfCliente.id}`
    });
    const ex = Array.isArray(list.json) ? list.json[0] : null;
    if (!ex) return skip('exercicios', 'Restrições em plano profissional', 'Sem exercício no plano profissional para testar');

    const deny = await req(`/exercicios/${ex.id}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { nome: `Nao permitido ${TS}` }
    });
    expectStatus('exercicios', 'Cliente não altera nome no plano profissional', deny, 403, {
      method: 'PUT',
      path: `/exercicios/${ex.id}`
    });

    const allow = await req(`/exercicios/${ex.id}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { series: ex.series, reps: ex.reps, notas: `feedback ${TS}` }
    });
    expectStatus('exercicios', 'Cliente altera campos permitidos no plano profissional', allow, 200, {
      method: 'PUT',
      path: `/exercicios/${ex.id}`
    });
  });

  await withCase('exercicios', 'Filtro plano_id em exercícios funciona', async () => {
    if (!planoPessoalCliente) return skip('exercicios', 'Filtro plano_id', 'Cliente sem plano pessoal');

    const r = await req(`/exercicios?plano_id=${planoPessoalCliente.id}`, { apiKey: cliente.apiKey });
    expectStatus('exercicios', 'GET /exercicios?plano_id', r, 200, {
      method: 'GET',
      path: `/exercicios?plano_id=${planoPessoalCliente.id}`
    });
    if (r.status === 200) {
      const ok = hasAll(r.json, (e) => e.planoId === planoPessoalCliente.id);
      expect('exercicios', 'Filtro plano_id retorna só exercícios do plano', ok, `planoId=${planoPessoalCliente.id}`, 'misturado', r.json);
    }
  });

  await withCase('exercicios', 'Admin cria exercício em plano existente', async () => {
    const plano = adminPlanos[0];
    if (!plano) return skip('exercicios', 'Admin cria exercício', 'Sem plano para associar exercício');
    const create = await req('/exercicios', {
      method: 'POST',
      apiKey: admin.apiKey,
      body: {
        planoId: plano.id,
        nome: `Ex Admin ${TS}`,
        grupoMuscular: 'Core',
        series: 3,
        reps: 12,
        ordem: 99
      }
    });
    expectStatus('exercicios', 'POST /exercicios (admin)', create, 201, { method: 'POST', path: '/exercicios' });
    const exId = create.json?.id;
    if (exId) registerCleanup(`apagar exercicio admin ${exId}`, async () => req(`/exercicios/${exId}`, { method: 'DELETE', apiKey: admin.apiKey }));
  });

  await withCase('exercicios', 'Treinador cria exercício em plano próprio', async () => {
    if (!planoTreinador) return skip('exercicios', 'Treinador cria exercício em plano próprio', 'Treinador sem plano profissional');
    const create = await req('/exercicios', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: {
        planoId: planoTreinador.id,
        nome: `Ex Treinador ${TS}`,
        grupoMuscular: 'Costas',
        series: 4,
        reps: 10,
        ordem: 98
      }
    });
    expectStatus('exercicios', 'POST /exercicios (treinador)', create, 201, { method: 'POST', path: '/exercicios' });
    const exId = create.json?.id;
    if (exId) registerCleanup(`apagar exercicio treinador ${exId}`, async () => req(`/exercicios/${exId}`, { method: 'DELETE', apiKey: admin.apiKey }));
  });

  await withCase('exercicios', 'Cliente cria exercício em plano pessoal', async () => {
    if (!planoPessoalCliente) return skip('exercicios', 'Cliente cria exercício em plano pessoal', 'Cliente sem plano pessoal');
    const create = await req('/exercicios', {
      method: 'POST',
      apiKey: cliente.apiKey,
      body: {
        planoId: planoPessoalCliente.id,
        nome: `Ex Cliente ${TS}`,
        grupoMuscular: 'Peito',
        series: 3,
        reps: 15,
        ordem: 97
      }
    });
    expectStatus('exercicios', 'POST /exercicios (cliente)', create, 201, { method: 'POST', path: '/exercicios' });
    const exId = create.json?.id;
    if (exId) registerCleanup(`apagar exercicio cliente ${exId}`, async () => req(`/exercicios/${exId}`, { method: 'DELETE', apiKey: admin.apiKey }));
  });

  await withCase('exercicios', 'Filtro cliente_id em exercícios respeita permissões', async () => {
    if (!planoTreinador?.clienteId) return skip('exercicios', 'Filtro cliente_id em exercícios', 'Sem cliente associado ao treinador');

    const byClienteAdmin = await req(`/exercicios?cliente_id=${planoTreinador.clienteId}`, { apiKey: admin.apiKey });
    expectStatus('exercicios', 'GET /exercicios?cliente_id (admin)', byClienteAdmin, 200, {
      method: 'GET',
      path: `/exercicios?cliente_id=${planoTreinador.clienteId}`
    });

    const byClienteTreinador = await req(`/exercicios?cliente_id=${planoTreinador.clienteId}`, { apiKey: treinador.apiKey });
    expectStatus('exercicios', 'GET /exercicios?cliente_id (treinador)', byClienteTreinador, 200, {
      method: 'GET',
      path: `/exercicios?cliente_id=${planoTreinador.clienteId}`
    });

    const byClienteCliente = await req(`/exercicios?cliente_id=${cliente.id}`, { apiKey: cliente.apiKey });
    expectStatus('exercicios', 'Cliente não pode usar cliente_id em /exercicios', byClienteCliente, 403, {
      method: 'GET',
      path: `/exercicios?cliente_id=${cliente.id}`
    });

    if (planoTreinador?.id) {
      const comboTreinador = await req(`/exercicios?cliente_id=${planoTreinador.clienteId}&plano_id=${planoTreinador.id}`, {
        apiKey: treinador.apiKey
      });
      expectStatus('exercicios', 'Treinador usa cliente_id + plano_id em /exercicios', comboTreinador, 200, {
        method: 'GET',
        path: `/exercicios?cliente_id=${planoTreinador.clienteId}&plano_id=${planoTreinador.id}`
      });
      if (comboTreinador.status === 200) {
        const ok = hasAll(comboTreinador.json, (e) => e.planoId === planoTreinador.id);
        expect('exercicios', 'Combinação cliente_id + plano_id retorna interseção em /exercicios', ok, `planoId=${planoTreinador.id}`, 'misturado', comboTreinador.json);
      }

      const conflictClient = allUsers.find(
        (u) => u.role === 'cliente' && Number(u.id) !== Number(planoTreinador.clienteId)
      );
      if (!conflictClient) return skip('exercicios', 'Combinação conflitante cliente_id + plano_id em /exercicios', 'Sem cliente diferente para conflito');
      const comboConflitante = await req(`/exercicios?cliente_id=${conflictClient.id}&plano_id=${planoTreinador.id}`, {
        apiKey: admin.apiKey
      });
      expectStatus('exercicios', 'Combinação conflitante cliente_id + plano_id em /exercicios', comboConflitante, 200, {
        method: 'GET',
        path: `/exercicios?cliente_id=${conflictClient.id}&plano_id=${planoTreinador.id}`
      });
      if (comboConflitante.status === 200) {
        const ok = Array.isArray(comboConflitante.json) && comboConflitante.json.length === 0;
        expect('exercicios', 'Combinação conflitante em /exercicios retorna vazio', ok, '[]', JSON.stringify(comboConflitante.json), comboConflitante.json);
      }
    }
  });

  // SESSOES: só contexto profissional e limites por treinador.
  await withCase('sessoes', 'Cliente não cria sessão', async () => {
    if (!planoProfCliente) return skip('sessoes', 'Cliente não cria sessão', 'Cliente sem plano profissional');
    const r = await req('/sessoes', {
      method: 'POST',
      apiKey: cliente.apiKey,
      body: { planoId: planoProfCliente.id, dataSessao: TODAY, duracaoMin: 60 }
    });
    expectStatus('sessoes', 'POST /sessoes (cliente)', r, 403, { method: 'POST', path: '/sessoes' });
  });

  await withCase('sessoes', 'Treinador cria sessão em plano próprio', async () => {
    if (!planoTreinador) return skip('sessoes', 'Treinador cria sessão', 'Treinador sem plano profissional');
    const create = await req('/sessoes', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: { planoId: planoTreinador.id, dataSessao: TODAY, duracaoMin: 45, notas: `sessao ${TS}` }
    });
    expectStatus('sessoes', 'POST /sessoes (treinador)', create, 201, { method: 'POST', path: '/sessoes' });
    const sessaoId = create.json?.id;
    if (!sessaoId) return;

    registerCleanup(`apagar sessao ${sessaoId}`, async () => {
      await req(`/sessoes/${sessaoId}`, { method: 'DELETE', apiKey: admin.apiKey });
    });

    const clienteUpdateTry = await req(`/sessoes/${sessaoId}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { estado: 'cancelada' }
    });
    expectStatus('sessoes', 'Cliente não altera estado da sessão', clienteUpdateTry, 403, {
      method: 'PUT',
      path: `/sessoes/${sessaoId}`
    });

    const clienteNotasOk = await req(`/sessoes/${sessaoId}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { notas: `feedback_${TS}` }
    });

    expectStatus('sessoes', 'Cliente atualiza notas da própria sessão', clienteNotasOk, [200, 403], {
      method: 'PUT',
      path: `/sessoes/${sessaoId}`
    });
  });

  await withCase('sessoes', 'Treinador não mexe em sessão de outro treinador', async () => {
    const { reg: regTrein2 } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_trainer_sess',
      usernamePrefix: 'tmp_trainer_sess'
    });
    expectStatus('sessoes', 'Register treinador2 (tmp)', regTrein2, 201, { method: 'POST', path: '/auth/register' });
    const trainer2Id = regTrein2.json?.id;
    const trainer2Key = regTrein2.json?.apiKey;
    if (!trainer2Id) return;
    await req(`/users/${trainer2Id}/role`, { method: 'PUT', apiKey: admin.apiKey, body: { role: 'treinador' } });

    const { reg: regClient2 } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_client_sess',
      usernamePrefix: 'tmp_client_sess'
    });
    expectStatus('sessoes', 'Register cliente2 (tmp)', regClient2, 201, { method: 'POST', path: '/auth/register' });
    const client2Id = regClient2.json?.id;
    if (!client2Id) return;

    const plano2 = await req('/planos', {
      method: 'POST',
      apiKey: trainer2Key,
      body: { titulo: `PlanoSess_${TS}`, objetivo: 'saude_geral', duracaoSem: 4, clienteId: client2Id }
    });
    expectStatus('sessoes', 'Treinador2 cria plano', plano2, 201, { method: 'POST', path: '/planos' });
    const plano2Id = plano2.json?.id;
    if (plano2Id) registerCleanup(`apagar plano sess ${plano2Id}`, async () => req(`/planos/${plano2Id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    const sess2 = await req('/sessoes', {
      method: 'POST',
      apiKey: trainer2Key,
      body: { planoId: plano2Id, dataSessao: TODAY, duracaoMin: 40, notas: `sess2_${TS}` }
    });
    expectStatus('sessoes', 'Treinador2 cria sessão', sess2, 201, { method: 'POST', path: '/sessoes' });
    const sess2Id = sess2.json?.id;
    if (sess2Id) registerCleanup(`apagar sessao outro ${sess2Id}`, async () => req(`/sessoes/${sess2Id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    const deny = await req(`/sessoes/${sess2Id}`, { method: 'PUT', apiKey: treinador.apiKey, body: { notas: 'x' } });
    expectStatus('sessoes', 'Treinador1 não edita sessão de treinador2', deny, 403, { method: 'PUT', path: `/sessoes/${sess2Id}` });
  });

  await withCase('sessoes', 'Filtros de sessões funcionam (estado/plano_id/cliente_id)', async () => {
    if (!planoTreinador) return skip('sessoes', 'Filtros de sessões', 'Treinador sem plano profissional');

    const s1 = await req('/sessoes', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: { planoId: planoTreinador.id, dataSessao: TODAY, duracaoMin: 30, notas: `filtro_s1_${TS}` }
    });
    expectStatus('sessoes', 'Criar sessão s1', s1, 201, { method: 'POST', path: '/sessoes' });
    const s1Id = s1.json?.id;
    if (s1Id) registerCleanup(`apagar sessao s1 ${s1Id}`, async () => req(`/sessoes/${s1Id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    const s2 = await req('/sessoes', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: { planoId: planoTreinador.id, dataSessao: TODAY, duracaoMin: 35, notas: `filtro_s2_${TS}` }
    });
    expectStatus('sessoes', 'Criar sessão s2', s2, 201, { method: 'POST', path: '/sessoes' });
    const s2Id = s2.json?.id;
    if (s2Id) registerCleanup(`apagar sessao s2 ${s2Id}`, async () => req(`/sessoes/${s2Id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    if (s2Id) {
      const upd = await req(`/sessoes/${s2Id}`, { method: 'PUT', apiKey: treinador.apiKey, body: { estado: 'concluida' } });
      expectStatus('sessoes', 'Atualizar estado s2->concluida', upd, 200, { method: 'PUT', path: `/sessoes/${s2Id}` });
    }

    const byPlano = await req(`/sessoes?plano_id=${planoTreinador.id}`, { apiKey: treinador.apiKey });
    expectStatus('sessoes', 'GET /sessoes?plano_id', byPlano, 200, { method: 'GET', path: `/sessoes?plano_id=${planoTreinador.id}` });
    if (byPlano.status === 200) {
      const ok = hasAll(byPlano.json, (s) => s.planoId === planoTreinador.id);
      expect('sessoes', 'Filtro plano_id filtra apenas planoId', ok, `planoId=${planoTreinador.id}`, 'misturado', byPlano.json);
    }

    const byCliente = await req(`/sessoes?cliente_id=${planoTreinador.clienteId}`, { apiKey: treinador.apiKey });
    expectStatus('sessoes', 'GET /sessoes?cliente_id', byCliente, 200, { method: 'GET', path: `/sessoes?cliente_id=${planoTreinador.clienteId}` });
    if (byCliente.status === 200) {
      const ok = hasAll(byCliente.json, (s) => s.clienteId === planoTreinador.clienteId);
      expect('sessoes', 'Filtro cliente_id filtra apenas clienteId', ok, `clienteId=${planoTreinador.clienteId}`, 'misturado', byCliente.json);
    }

    const clienteNaoPodeFiltrarClienteId = await req(`/sessoes?cliente_id=${planoTreinador.clienteId}`, { apiKey: cliente.apiKey });
    expectStatus('sessoes', 'Cliente não pode usar filtro cliente_id em /sessoes', clienteNaoPodeFiltrarClienteId, 403, {
      method: 'GET',
      path: `/sessoes?cliente_id=${planoTreinador.clienteId}`
    });

    const byEstado = await req('/sessoes?estado=concluida', { apiKey: treinador.apiKey });
    expectStatus('sessoes', 'GET /sessoes?estado=concluida', byEstado, 200, { method: 'GET', path: '/sessoes?estado=concluida' });
    if (byEstado.status === 200) {
      const ok = hasAll(byEstado.json, (s) => s.estado === 'concluida');
      expect('sessoes', 'Filtro estado filtra apenas estado=concluida', ok, 'estado=concluida', 'misturado', byEstado.json);
    }
  });

  // AVALIACOES: separa fluxos pessoal vs profissional.
  await withCase('avaliacoes', 'Cliente cria/edita/apaga avaliação pessoal própria', async () => {
    const r = await req('/avaliacoes', {
      method: 'POST',
      apiKey: cliente.apiKey,
      body: { data: TODAY, pesoKg: 70, alturaCm: 170 }
    });
    expectStatus('avaliacoes', 'POST /avaliacoes (cliente pessoal)', r, 201, { method: 'POST', path: '/avaliacoes' });

    const avaliacaoId = r.json?.id;
    if (!avaliacaoId) return;

    registerCleanup(`apagar avaliacao cliente ${avaliacaoId}`, async () => {
      await req(`/avaliacoes/${avaliacaoId}`, { method: 'DELETE', apiKey: admin.apiKey });
    });

    const updateClienteAvaliacao = await req(`/avaliacoes/${avaliacaoId}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { notas: `avaliacao pessoal editada ${TS}` }
    });
    expectStatus('avaliacoes', 'Cliente atualiza avaliação pessoal própria', updateClienteAvaliacao, 200, {
      method: 'PUT',
      path: `/avaliacoes/${avaliacaoId}`
    });

    const del = await req(`/avaliacoes/${avaliacaoId}`, { method: 'DELETE', apiKey: cliente.apiKey });
    expectStatus('avaliacoes', 'Cliente apaga avaliação pessoal própria', del, 200, {
      method: 'DELETE',
      path: `/avaliacoes/${avaliacaoId}`
    });
  });

  await withCase('avaliacoes', 'Treinador cria/edita/apaga avaliação no seu âmbito', async () => {
    if (!planoTreinador) return skip('avaliacoes', 'Fluxo treinador avaliação', 'Treinador sem plano profissional');
    const create = await req('/avaliacoes', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: {
        clienteId: planoTreinador.clienteId,
        data: TODAY,
        pesoKg: 68,
        alturaCm: 172,
        notas: `avaliacao ${TS}`
      }
    });
    expectStatus('avaliacoes', 'POST /avaliacoes (treinador)', create, 201, { method: 'POST', path: '/avaliacoes' });
    const avId = create.json?.id;
    if (!avId) return;

    registerCleanup(`apagar avaliacao ${avId}`, async () => {
      await req(`/avaliacoes/${avId}`, { method: 'DELETE', apiKey: admin.apiKey });
    });

    const updateByTrainer = await req(`/avaliacoes/${avId}`, {
      method: 'PUT',
      apiKey: treinador.apiKey,
      body: { notas: `avaliacao editada ${TS}` }
    });
    expectStatus('avaliacoes', 'PUT /avaliacoes/:id pelo criador treinador', updateByTrainer, 200, {
      method: 'PUT',
      path: `/avaliacoes/${avId}`
    });

    const updateByClient = await req(`/avaliacoes/${avId}`, {
      method: 'PUT',
      apiKey: cliente.apiKey,
      body: { notas: 'tentativa indevida' }
    });
    expectStatus('avaliacoes', 'Cliente não edita avaliação', updateByClient, 403, {
      method: 'PUT',
      path: `/avaliacoes/${avId}`
    });
  });

  await withCase('avaliacoes', 'Admin cria avaliação para cliente', async () => {
    const adminClient = allUsers.find((u) => u.role === 'cliente');
    if (!adminClient) return skip('avaliacoes', 'Admin cria avaliação para cliente', 'Sem cliente para associar');
    const create = await req('/avaliacoes', {
      method: 'POST',
      apiKey: admin.apiKey,
      body: {
        clienteId: adminClient.id,
        data: TODAY,
        pesoKg: 77,
        alturaCm: 175,
        notas: `av_admin_${TS}`
      }
    });
    expectStatus('avaliacoes', 'POST /avaliacoes (admin)', create, 201, { method: 'POST', path: '/avaliacoes' });
    const avId = create.json?.id;
    if (avId) registerCleanup(`apagar avaliacao admin ${avId}`, async () => req(`/avaliacoes/${avId}`, { method: 'DELETE', apiKey: admin.apiKey }));
  });

  await withCase('avaliacoes', 'Treinador não mexe em avaliação pessoal do cliente', async () => {

    const create = await req('/avaliacoes', { method: 'POST', apiKey: cliente.apiKey, body: { data: TODAY, notas: `pessoal_${TS}` } });
    expectStatus('avaliacoes', 'Cliente cria avaliação pessoal', create, 201, { method: 'POST', path: '/avaliacoes' });
    const id = create.json?.id;
    if (!id) return;
    registerCleanup(`apagar avaliacao pessoal ${id}`, async () => req(`/avaliacoes/${id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    const denyPut = await req(`/avaliacoes/${id}`, { method: 'PUT', apiKey: treinador.apiKey, body: { notas: 'x' } });
    expectStatus('avaliacoes', 'Treinador não edita avaliação pessoal', denyPut, 403, { method: 'PUT', path: `/avaliacoes/${id}` });
    const denyDel = await req(`/avaliacoes/${id}`, { method: 'DELETE', apiKey: treinador.apiKey });
    expectStatus('avaliacoes', 'Treinador não apaga avaliação pessoal', denyDel, 403, { method: 'DELETE', path: `/avaliacoes/${id}` });
  });

  await withCase('avaliacoes', 'Filtro cliente_id em avaliações funciona', async () => {
    if (!planoTreinador) return skip('avaliacoes', 'Filtro cliente_id', 'Treinador sem plano profissional');
    const r = await req(`/avaliacoes?cliente_id=${planoTreinador.clienteId}`, { apiKey: treinador.apiKey });
    expectStatus('avaliacoes', 'GET /avaliacoes?cliente_id', r, 200, { method: 'GET', path: `/avaliacoes?cliente_id=${planoTreinador.clienteId}` });
    if (r.status === 200) {
      const ok = hasAll(r.json, (a) => a.clienteId === planoTreinador.clienteId);
      expect('avaliacoes', 'Filtro cliente_id retorna só esse cliente', ok, `clienteId=${planoTreinador.clienteId}`, 'misturado', r.json);
    }
  });

  await withCase('avaliacoes', 'Filtro clienteId (camelCase) em avaliações é ignorado', async () => {
    if (!planoTreinador) return skip('avaliacoes', 'Filtro clienteId (camelCase)', 'Treinador sem plano profissional');
    const r = await req(`/avaliacoes?clienteId=${planoTreinador.clienteId}`, { apiKey: treinador.apiKey });
    expectStatus('avaliacoes', 'GET /avaliacoes?clienteId', r, 200, { method: 'GET', path: `/avaliacoes?clienteId=${planoTreinador.clienteId}` });
    if (r.status === 200) {
      const ok = Array.isArray(r.json);
      expect('avaliacoes', 'clienteId (camelCase) não quebra listagem', ok, 'lista válida', 'resposta inválida', r.json);
    }
  });

  // METAS: regras de plano pessoal/profissional e permissões por role.
  await withCase('metas', 'Cliente só cria meta em plano pessoal próprio', async () => {
    if (!planoPessoalCliente) return skip('metas', 'Cliente cria meta em plano pessoal', 'Cliente sem plano pessoal');

    const createOk = await req('/metas', {
      method: 'POST',
      apiKey: cliente.apiKey,
      body: {
        planoId: planoPessoalCliente.id,
        descricao: `Meta pessoal ${TS}`,
        valorAlvo: 5,
        unidade: 'kg',
        prazo: TODAY
      }
    });
    expectStatus('metas', 'POST /metas em plano pessoal próprio', createOk, 201, { method: 'POST', path: '/metas' });
    const metaId = createOk.json?.id;
    if (metaId) {

      registerCleanup(`apagar meta ${metaId}`, async () => {
        await req(`/metas/${metaId}`, { method: 'DELETE', apiKey: admin.apiKey });
      });

      const updateDescricao = await req(`/metas/${metaId}`, {
        method: 'PUT',
        apiKey: cliente.apiKey,
        body: { descricao: `Descricao editada ${TS}` }
      });
      expectStatus('metas', 'Cliente altera descricao da meta pessoal', updateDescricao, 200, {
        method: 'PUT',
        path: `/metas/${metaId}`
      });

      const updateAllowed = await req(`/metas/${metaId}`, {
        method: 'PUT',
        apiKey: cliente.apiKey,
        body: { valorAtual: 2 }
      });
      expectStatus('metas', 'Cliente altera valorAtual da meta pessoal', updateAllowed, 200, {
        method: 'PUT',
        path: `/metas/${metaId}`
      });
    }

    if (planoProfCliente) {
      const createForbidden = await req('/metas', {
        method: 'POST',
        apiKey: cliente.apiKey,
        body: {
          planoId: planoProfCliente.id,
          descricao: `Meta proibida ${TS}`
        }
      });
      expectStatus('metas', 'Cliente não cria meta em plano profissional', createForbidden, 403, {
        method: 'POST',
        path: '/metas'
      });
    } else {
      skip('metas', 'Cliente não cria meta em plano profissional', 'Cliente sem plano profissional');
    }
  });

  await withCase('metas', 'Treinador não mexe em meta de plano pessoal', async () => {
    if (!planoPessoalCliente) return skip('metas', 'Treinador não mexe em meta pessoal', 'Cliente sem plano pessoal');
    const create = await req('/metas', { method: 'POST', apiKey: cliente.apiKey, body: { planoId: planoPessoalCliente.id, descricao: `meta_pessoal_${TS}` } });
    expectStatus('metas', 'Cliente cria meta pessoal', create, 201, { method: 'POST', path: '/metas' });
    const id = create.json?.id;
    if (!id) return;
    registerCleanup(`apagar meta pessoal ${id}`, async () => req(`/metas/${id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    const denyPut = await req(`/metas/${id}`, { method: 'PUT', apiKey: treinador.apiKey, body: { descricao: 'x' } });
    expectStatus('metas', 'Treinador não edita meta pessoal', denyPut, 403, { method: 'PUT', path: `/metas/${id}` });
    const denyDel = await req(`/metas/${id}`, { method: 'DELETE', apiKey: treinador.apiKey });
    expectStatus('metas', 'Treinador não apaga meta pessoal', denyDel, 403, { method: 'DELETE', path: `/metas/${id}` });
  });

  await withCase('metas', 'Admin cria meta em plano profissional', async () => {
    if (!planoTreinador) return skip('metas', 'Admin cria meta em plano profissional', 'Sem plano profissional para associar');
    const create = await req('/metas', {
      method: 'POST',
      apiKey: admin.apiKey,
      body: {
        planoId: planoTreinador.id,
        clienteId: planoTreinador.clienteId,
        descricao: `Meta admin ${TS}`,
        valorAlvo: 3,
        unidade: 'kg',
        prazo: TODAY
      }
    });
    expectStatus('metas', 'POST /metas (admin)', create, 201, { method: 'POST', path: '/metas' });
    const metaId = create.json?.id;
    if (metaId) registerCleanup(`apagar meta admin ${metaId}`, async () => req(`/metas/${metaId}`, { method: 'DELETE', apiKey: admin.apiKey }));
  });

  await withCase('metas', 'Treinador cria meta em plano profissional próprio', async () => {
    if (!planoTreinador) return skip('metas', 'Treinador cria meta em plano profissional próprio', 'Sem plano profissional para associar');
    const create = await req('/metas', {
      method: 'POST',
      apiKey: treinador.apiKey,
      body: {
        planoId: planoTreinador.id,
        clienteId: planoTreinador.clienteId,
        descricao: `Meta treinador ${TS}`,
        valorAlvo: 2,
        unidade: 'cm',
        prazo: TODAY
      }
    });
    expectStatus('metas', 'POST /metas (treinador)', create, 201, { method: 'POST', path: '/metas' });
    const metaId = create.json?.id;
    if (metaId) registerCleanup(`apagar meta treinador ${metaId}`, async () => req(`/metas/${metaId}`, { method: 'DELETE', apiKey: admin.apiKey }));
  });

  await withCase('metas', 'Filtros cliente_id e plano_id em metas funcionam', async () => {
    if (!planoTreinador?.clienteId) return skip('metas', 'Filtros em metas', 'Treinador sem plano profissional');

    const byClienteAdmin = await req(`/metas?cliente_id=${planoTreinador.clienteId}`, { apiKey: admin.apiKey });
    expectStatus('metas', 'GET /metas?cliente_id (admin)', byClienteAdmin, 200, {
      method: 'GET',
      path: `/metas?cliente_id=${planoTreinador.clienteId}`
    });
    if (byClienteAdmin.status === 200) {
      const ok = hasAll(byClienteAdmin.json, (m) => m.clienteId === planoTreinador.clienteId);
      expect('metas', 'Filtro cliente_id em metas (admin)', ok, `clienteId=${planoTreinador.clienteId}`, 'misturado', byClienteAdmin.json);
    }

    const byClienteTreinador = await req(`/metas?cliente_id=${planoTreinador.clienteId}`, { apiKey: treinador.apiKey });
    expectStatus('metas', 'GET /metas?cliente_id (treinador)', byClienteTreinador, 200, {
      method: 'GET',
      path: `/metas?cliente_id=${planoTreinador.clienteId}`
    });

    const byPlanoAdmin = await req(`/metas?plano_id=${planoTreinador.id}`, { apiKey: admin.apiKey });
    expectStatus('metas', 'GET /metas?plano_id (admin)', byPlanoAdmin, 200, {
      method: 'GET',
      path: `/metas?plano_id=${planoTreinador.id}`
    });
    if (byPlanoAdmin.status === 200) {
      const ok = hasAll(byPlanoAdmin.json, (m) => m.planoId === planoTreinador.id);
      expect('metas', 'Filtro plano_id em metas (admin)', ok, `planoId=${planoTreinador.id}`, 'misturado', byPlanoAdmin.json);
    }
  });

  // FILTERS: validação de parâmetros e consistência entre endpoints.
  await withCase('filters', 'Parâmetros inválidos retornam 400', async () => {
    const invalidCases = [
      { path: '/planos?cliente_id=abc', role: admin.apiKey, label: 'planos cliente_id string' },
      { path: '/exercicios?cliente_id=-1', role: admin.apiKey, label: 'exercicios cliente_id negativo' },
      { path: '/exercicios?plano_id=0', role: admin.apiKey, label: 'exercicios plano_id zero' },
      { path: '/metas?cliente_id=0', role: admin.apiKey, label: 'metas cliente_id zero' },
      { path: '/metas?plano_id=abc', role: admin.apiKey, label: 'metas plano_id string' },
      { path: '/users?cliente_id=abc', role: admin.apiKey, label: 'users cliente_id string' },
      { path: '/users?treinador_id=0', role: admin.apiKey, label: 'users treinador_id zero' },
      { path: '/sessoes?plano_id=abc', role: admin.apiKey, label: 'sessoes plano_id string' },
      { path: '/sessoes?cliente_id=0', role: admin.apiKey, label: 'sessoes cliente_id zero' }
    ];

    for (const c of invalidCases) {
      const r = await req(c.path, { apiKey: c.role });
      expectStatus('filters', `400 para filtro inválido: ${c.label}`, r, 400, { method: 'GET', path: c.path });
    }
  });

  await withCase('filters', 'IDs inexistentes têm comportamento consistente', async () => {
    const nonexistentId = 99999999;

    const exByPlano = await req(`/exercicios?plano_id=${nonexistentId}`, { apiKey: admin.apiKey });
    expectStatus('filters', 'GET /exercicios?plano_id inexistente', exByPlano, 200, {
      method: 'GET',
      path: `/exercicios?plano_id=${nonexistentId}`
    });
    if (exByPlano.status === 200) {
      const ok = Array.isArray(exByPlano.json) && exByPlano.json.length === 0;
      expect('filters', 'Exercícios com plano inexistente retorna vazio', ok, '[]', JSON.stringify(exByPlano.json), exByPlano.json);
    }

    const metasByPlano = await req(`/metas?plano_id=${nonexistentId}`, { apiKey: admin.apiKey });
    expectStatus('filters', 'GET /metas?plano_id inexistente', metasByPlano, 200, {
      method: 'GET',
      path: `/metas?plano_id=${nonexistentId}`
    });
    if (metasByPlano.status === 200) {
      const ok = Array.isArray(metasByPlano.json) && metasByPlano.json.length === 0;
      expect('filters', 'Metas com plano inexistente retorna vazio', ok, '[]', JSON.stringify(metasByPlano.json), metasByPlano.json);
    }
  });

  await withCase('filters', 'Treinador bloqueado ao filtrar cliente de outro treinador', async () => {
    const { reg: regTrein2 } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_trainer_filter',
      usernamePrefix: 'tmp_trainer_filter'
    });
    expectStatus('filters', 'Register treinador2 para filtros', regTrein2, 201, { method: 'POST', path: '/auth/register' });
    const trainer2Id = regTrein2.json?.id;
    const trainer2Key = regTrein2.json?.apiKey;
    if (!trainer2Id) return;

    const promote = await req(`/users/${trainer2Id}/role`, { method: 'PUT', apiKey: admin.apiKey, body: { role: 'treinador' } });
    expectStatus('filters', 'Promover treinador2 para filtros', promote, 200, { method: 'PUT', path: `/users/${trainer2Id}/role` });

    const { reg: regClient2 } = await createBasicUserViaRegister({
      emailPrefix: 'tmp_client_filter',
      usernamePrefix: 'tmp_client_filter'
    });
    expectStatus('filters', 'Register cliente2 para filtros', regClient2, 201, { method: 'POST', path: '/auth/register' });
    const client2Id = regClient2.json?.id;
    if (!client2Id) return;

    const plano2 = await req('/planos', {
      method: 'POST',
      apiKey: trainer2Key,
      body: { titulo: `PlanoFiltro_${TS}`, objetivo: 'saude_geral', duracaoSem: 4, clienteId: client2Id }
    });
    expectStatus('filters', 'Treinador2 cria plano para filtros', plano2, 201, { method: 'POST', path: '/planos' });
    const plano2Id = plano2.json?.id;
    if (plano2Id) registerCleanup(`apagar plano filtro ${plano2Id}`, async () => req(`/planos/${plano2Id}`, { method: 'DELETE', apiKey: admin.apiKey }));

    const endpoints = [
      '/planos',
      '/exercicios',
      '/metas',
      '/users'
    ];
    for (const ep of endpoints) {
      const r = await req(`${ep}?cliente_id=${client2Id}`, { apiKey: treinador.apiKey });
      expectStatus('filters', `Treinador1 bloqueado em ${ep}?cliente_id=cliente_de_outro`, r, 403, {
        method: 'GET',
        path: `${ep}?cliente_id=${client2Id}`
      });
    }
  });

  await withCase('filters', 'Combinação de filtros em metas funciona e detecta conflito', async () => {
    if (!planoTreinador?.clienteId) return skip('filters', 'Combinação de filtros em metas', 'Treinador sem plano profissional');
    const okCombo = await req(`/metas?cliente_id=${planoTreinador.clienteId}&plano_id=${planoTreinador.id}`, { apiKey: admin.apiKey });
    expectStatus('filters', 'GET /metas com cliente_id+plano_id compatíveis', okCombo, 200, {
      method: 'GET',
      path: `/metas?cliente_id=${planoTreinador.clienteId}&plano_id=${planoTreinador.id}`
    });
    if (okCombo.status === 200) {
      const ok = hasAll(okCombo.json, (m) => m.clienteId === planoTreinador.clienteId && m.planoId === planoTreinador.id);
      expect('filters', 'Metas com filtros combinados compatíveis', ok, `clienteId=${planoTreinador.clienteId} e planoId=${planoTreinador.id}`, 'misturado', okCombo.json);
    }

    const conflictClient = allUsers.find((u) => u.role === 'cliente' && u.id !== planoTreinador.clienteId);
    if (!conflictClient) return skip('filters', 'GET /metas com cliente_id+plano_id conflitantes', 'Sem cliente diferente do plano para montar conflito');
    const conflictCombo = await req(`/metas?cliente_id=${conflictClient.id}&plano_id=${planoTreinador.id}`, { apiKey: admin.apiKey });
    expectStatus('filters', 'GET /metas com cliente_id+plano_id conflitantes', conflictCombo, 200, {
      method: 'GET',
      path: `/metas?cliente_id=${conflictClient.id}&plano_id=${planoTreinador.id}`
    });
    if (conflictCombo.status === 200) {
      const ok = Array.isArray(conflictCombo.json) && conflictCombo.json.length === 0;
      expect('filters', 'Metas com filtros conflitantes retorna vazio', ok, '[]', JSON.stringify(conflictCombo.json), conflictCombo.json);
    }
  });

  await withCase('filters', 'clienteId camelCase em /avaliacoes é ignorado', async () => {
    if (!planoTreinador?.clienteId) return skip('filters', 'clienteId camelCase em /avaliacoes', 'Treinador sem plano profissional');
    const semFiltro = await req('/avaliacoes', { apiKey: treinador.apiKey });
    expectStatus('filters', 'GET /avaliacoes sem filtro (treinador)', semFiltro, 200, { method: 'GET', path: '/avaliacoes' });
    const comCamel = await req(`/avaliacoes?clienteId=${planoTreinador.clienteId}`, { apiKey: treinador.apiKey });
    expectStatus('filters', 'GET /avaliacoes?clienteId (camelCase)', comCamel, 200, {
      method: 'GET',
      path: `/avaliacoes?clienteId=${planoTreinador.clienteId}`
    });
    if (semFiltro.status === 200 && comCamel.status === 200) {
      const semIds = onlyIds(semFiltro.json);
      const comIds = onlyIds(comCamel.json);
      const sameLen = semIds.length === comIds.length;
      expect('filters', 'clienteId camelCase não altera resultado de /avaliacoes', sameLen, `mesmo tamanho=${semIds.length}`, `tam sem=${semIds.length} tam com=${comIds.length}`, {
        semFiltro: semIds,
        comCamel: comIds
      });
    }
  });

  await withCase('admin', 'Admin lista recursos principais', async () => {
    const commonEndpoints = ['/planos', '/sessoes', '/avaliacoes', '/metas', '/users'];
    for (const ep of commonEndpoints) {
      const r = await req(ep, { apiKey: admin.apiKey });
      expectStatus('admin', `GET ${ep} (admin)`, r, 200, { method: 'GET', path: ep });
    }

    const planoParaExercicios = adminPlanos[0];
    if (!planoParaExercicios) {
      skip('admin', 'GET /exercicios (admin)', 'Sem plano disponível para enviar plano_id');
      return;
    }
    const exerciciosAdmin = await req(`/exercicios?plano_id=${planoParaExercicios.id}`, { apiKey: admin.apiKey });
    expectStatus('admin', 'GET /exercicios (admin)', exerciciosAdmin, 200, {
      method: 'GET',
      path: `/exercicios?plano_id=${planoParaExercicios.id}`
    });
  });

  await runCleanup();

  const summary = results.reduce(
    (acc, r) => {
      acc.total += 1;
      acc[r.status] += 1;
      return acc;
    },
    { total: 0, pass: 0, fail: 0, skip: 0 }
  );

  const failedCases = results.filter((r) => r.status === 'fail');
  const skippedCases = results.filter((r) => r.status === 'skip');
  const passedAll = summary.fail === 0;

  const inferRoleFromLabel = (label = '') => {
    const lower = String(label).toLowerCase();
    if (lower.includes('admin')) return 'admin';
    if (lower.includes('treinador')) return 'treinador';
    if (lower.includes('cliente')) return 'cliente';
    return null;
  };

  const observedCoverage = new Set(
    results
      .filter((r) => r.request?.method && r.request?.path)
      .map((r) => {
        const role = inferRoleFromLabel(r.label);
        if (!role) return null;
        return `${r.request.method}:${canonicalizePath(r.request.path)}:${role}`;
      })
      .filter(Boolean)
  );

  const expectedCoverage = [
    ['GET', '/users', 'admin'],
    ['GET', '/users', 'treinador'],
    ['GET', '/users', 'cliente'],
    ['GET', '/planos', 'admin'],
    ['GET', '/planos', 'treinador'],
    ['GET', '/planos', 'cliente'],
    ['GET', '/exercicios', 'admin'],
    ['GET', '/exercicios', 'treinador'],
    ['GET', '/exercicios', 'cliente'],
    ['GET', '/avaliacoes', 'admin'],
    ['GET', '/avaliacoes', 'treinador'],
    ['GET', '/avaliacoes', 'cliente'],
    ['GET', '/metas', 'admin'],
    ['GET', '/metas', 'treinador'],
    ['GET', '/metas', 'cliente'],
    ['POST', '/planos', 'admin'],
    ['POST', '/planos', 'treinador'],
    ['POST', '/planos', 'cliente'],
    ['POST', '/exercicios', 'admin'],
    ['POST', '/exercicios', 'treinador'],
    ['POST', '/exercicios', 'cliente'],
    ['POST', '/avaliacoes', 'admin'],
    ['POST', '/avaliacoes', 'treinador'],
    ['POST', '/avaliacoes', 'cliente'],
    ['POST', '/metas', 'admin'],
    ['POST', '/metas', 'treinador'],
    ['POST', '/metas', 'cliente']
  ];

  const missingCoverage = expectedCoverage
    .map(([method, path, role]) => `${method}:${path}:${role}`)
    .filter((key) => !observedCoverage.has(key));

  const printSummaryBlock = () => {
    console.log('\n========================================');
    console.log('[roleRulesCheck] RESULTADO FINAL');
    console.log(`STATUS: ${passedAll ? 'PASSOU' : 'FALHOU'}`);
    console.log(`TOTAL: ${summary.total} | PASS: ${summary.pass} | FAIL: ${summary.fail} | SKIP: ${summary.skip}`);
    console.log('========================================\n');
  };

  if (failedCases.length > 0) {
    console.log('Falhas encontradas:');
    failedCases.forEach((f, idx) => {
      console.log(
        `${idx + 1}. [${f.area}] ${f.label} | esperado=${f.expected} | obtido=${f.got}`
      );
    });
    console.log('');
  }

  if (skippedCases.length > 0) {
    console.log('Casos ignorados (skip):');
    skippedCases.forEach((s, idx) => {
      console.log(`${idx + 1}. [${s.area}] ${s.label} | motivo=${s.reason || 'n/a'}`);
    });
    console.log('');
  }

  if (VERBOSE) {
    console.log('Relatório detalhado (JSON):');
    console.log(JSON.stringify({
      summary,
      results
    }, null, 2));
  }

  printSummaryBlock();

  if (summary.fail > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await runCleanup();
  process.exit(1);
});
