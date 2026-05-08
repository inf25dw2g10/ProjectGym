/* 
Os ficheiros *seed* foram criados com IA de maneira a preencher com dados a estrutura dada. Exemplo de prompt: "gera dados aleatórios de modo a preencher os campos apresentados."
*/

'use strict';
 
const bcrypt = require('bcryptjs');
 

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const hashAdmin = await bcrypt.hash('admin123', 12);
    const hashTreinador = await bcrypt.hash('treinador123', 12);
    const hashCliente = await bcrypt.hash('cliente123', 12);
    const hashAlt = await bcrypt.hash('Segura!2026', 12);

    const usuarios = [
      {
        provider_id: 'basic_admin_001',
        provider: 'basic',
        username: 'admin',
        display_name: 'Admin Sistema',
        email: 'admin@gym.pt',
        password_hash: hashAdmin,
        api_key: 'apikey_admin_001',
        role: 'admin'
      },
      { provider_id: 'gh_admin_002', provider: 'github', username: 'admin_ops_gh', display_name: 'Admin Ops GitHub', email: 'admin.github@gym.pt', role: 'admin' },
      { provider_id: 'gg_admin_003', provider: 'google', username: 'admin_ops_gg', display_name: 'Admin Ops Google', email: 'admin.google@gym.pt', role: 'admin' },
      {
        provider_id: 'basic_treinador_001',
        provider: 'basic',
        username: 'treinador',
        display_name: 'Treinador Teste',
        email: 'treinador@gym.pt',
        password_hash: hashTreinador,
        api_key: 'apikey_treinador_001',
        role: 'treinador'
      },
      {
        provider_id: 'basic_cliente_001',
        provider: 'basic',
        username: 'cliente',
        display_name: 'Cliente Teste',
        email: 'cliente@gym.pt',
        password_hash: hashCliente,
        api_key: 'apikey_cliente_001',
        role: 'cliente'
      },
      { provider_id: 'gh_trainer_002', provider: 'github', username: 'joao_fitness', display_name: 'Joao Ferreira', email: 'joao.treinador@ptapp.pt', role: 'treinador' },
      { provider_id: 'gh_trainer_003', provider: 'github', username: 'ana_fit', display_name: 'Ana Rodrigues', email: 'ana.treinador@ptapp.pt', role: 'treinador' },
      { provider_id: 'gh_trainer_004', provider: 'github', username: 'carlos_gym', display_name: 'Carlos Mendes', email: 'carlos.treinador@ptapp.pt', role: 'treinador' },
      { provider_id: 'gg_trainer_005', provider: 'google', username: 'lara_coach', display_name: 'Lara Coach', email: 'lara.treinador@ptapp.pt', role: 'treinador' },
      { provider_id: 'gg_trainer_006', provider: 'google', username: 'pedro_coach', display_name: 'Pedro Coach', email: 'pedro.treinador@ptapp.pt', role: 'treinador' },
      { provider_id: 'gh_cliente_005', provider: 'github', username: 'maria_s', display_name: 'Maria Silva', email: 'maria@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_006', provider: 'github', username: 'pedro_c', display_name: 'Pedro Costa', email: 'pedro@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_007', provider: 'github', username: 'sofia_l', display_name: 'Sofia Lopes', email: 'sofia@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_008', provider: 'google', username: 'rui_g', display_name: 'Rui Gomes', email: 'rui@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_009', provider: 'github', username: 'ines_m', display_name: 'Ines Martins', email: 'ines@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_010', provider: 'github', username: 'bruno_a', display_name: 'Bruno Alves', email: 'bruno@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_011', provider: 'github', username: 'catarina_n', display_name: 'Catarina Neves', email: 'catarina@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_012', provider: 'github', username: 'tiago_p', display_name: 'Tiago Pinto', email: 'tiago@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_013', provider: 'github', username: 'beatriz_s', display_name: 'Beatriz Santos', email: 'beatriz@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_014', provider: 'google', username: 'andre_c', display_name: 'Andre Carvalho', email: 'andre@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_015', provider: 'github', username: 'filipa_r', display_name: 'Filipa Ribeiro', email: 'filipa@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_016', provider: 'github', username: 'miguel_s', display_name: 'Miguel Sousa', email: 'miguel@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_017', provider: 'github', username: 'margarida_d', display_name: 'Margarida Dias', email: 'margarida@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_018', provider: 'github', username: 'goncalo_v', display_name: 'Goncalo Vieira', email: 'goncalo@email.pt', role: 'cliente' },
      { provider_id: 'gh_cliente_019', provider: 'github', username: 'leonor_f', display_name: 'Leonor Faria', email: 'leonor@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_020', provider: 'google', username: 'rafael_m', display_name: 'Rafael Moreira', email: 'rafael@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_021', provider: 'google', username: 'daniela_c', display_name: 'Daniela Cunha', email: 'daniela@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_022', provider: 'google', username: 'hugo_t', display_name: 'Hugo Teixeira', email: 'hugo@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_023', provider: 'google', username: 'vanessa_p', display_name: 'Vanessa Pereira', email: 'vanessa@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_024', provider: 'google', username: 'diogo_m', display_name: 'Diogo Monteiro', email: 'diogo@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_025', provider: 'google', username: 'joana_a', display_name: 'Joana Azevedo', email: 'joana@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_026', provider: 'google', username: 'paulo_f', display_name: 'Paulo Fernandes', email: 'paulo@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_027', provider: 'google', username: 'marta_co', display_name: 'Marta Correia', email: 'marta@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_028', provider: 'google', username: 'nuno_ca', display_name: 'Nuno Cardoso', email: 'nuno@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_029', provider: 'google', username: 'rita_h', display_name: 'Rita Henriques', email: 'rita@email.pt', role: 'cliente' },
      { provider_id: 'gg_cliente_030', provider: 'google', username: 'sergio_b', display_name: 'Sergio Borges', email: 'sergio@email.pt', role: 'cliente' },
      {
        provider_id: 'google_104022240961348350514',
        provider: 'google',
        username: 'marta_vieira',
        display_name: 'Marta Vieira',
        email: 'martalberto007@gmail.com',
        avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocIZ89mChBPs2LXZkTyhPRwvymGuHz-l0yix9E_0oSvtTwVYwtDZ=s96-c',
        api_key: '4eedcd87a6a58f98f364012c08bd7b820c66de1472e5b587d4612b103ef68d1e',
        role: 'cliente'
      },
      {
        provider_id: '215171112',
        provider: 'github',
        username: 'xmarta19',
        display_name: 'marta',
        email: 'A046756@umaia.pt',
        avatar_url: 'https://avatars.githubusercontent.com/u/215171112?v=4',
        api_key: '34d74ae23b9565f23ca0dafcac242e0afc3f3b626fc63f684a950740bef255ec',
        role: 'treinador'
      }
    ];

    const trainersBasic = [
      ['basic_treinador_005', 'treinador_luisa', 'Luisa Nogueira', 'luisa.treinador@gym.pt'],
      ['basic_treinador_006', 'treinador_tomas', 'Tomas Veloso', 'tomas.treinador@gym.pt'],
      ['basic_treinador_007', 'treinador_helena', 'Helena Matos', 'helena.treinador@gym.pt']
    ];

    trainersBasic.forEach(([provider_id, username, display_name, email]) => {
      usuarios.push({
        provider_id,
        provider: 'basic',
        username,
        display_name,
        email,
        password_hash: hashAlt,
        role: 'treinador'
      });
    });

    const clientesExtra = [
      ['github', 'gh_cliente_031', 'carla_n', 'Carla Nascimento'],
      ['google', 'gg_cliente_032', 'vitor_a', 'Vitor Antunes'],
      ['basic', 'basic_cliente_033', 'ines_duarte', 'Ines Duarte'],
      ['github', 'gh_cliente_034', 'samuel_o', 'Samuel Oliveira'],
      ['google', 'gg_cliente_035', 'telma_r', 'Telma Rocha'],
      ['basic', 'basic_cliente_036', 'rodrigo_p', 'Rodrigo Pires'],
      ['github', 'gh_cliente_037', 'lara_b', 'Lara Batista'],
      ['google', 'gg_cliente_038', 'eva_t', 'Eva Tavares'],
      ['basic', 'basic_cliente_039', 'daniel_l', 'Daniel Leal'],
      ['github', 'gh_cliente_040', 'alice_f', 'Alice Freitas'],
      ['google', 'gg_cliente_041', 'jorge_q', 'Jorge Queiros'],
      ['basic', 'basic_cliente_042', 'mario_v', 'Mario Vieira'],
      ['github', 'gh_cliente_043', 'claudia_c', 'Claudia Coelho'],
      ['google', 'gg_cliente_044', 'bianca_x', 'Bianca Xavier'],
      ['basic', 'basic_cliente_045', 'patricia_m', 'Patricia Monteiro'],
      ['github', 'gh_cliente_046', 'david_h', 'David Henriques'],
      ['google', 'gg_cliente_047', 'orlando_k', 'Orlando Kosta'],
      ['basic', 'basic_cliente_048', 'nadia_i', 'Nadia Inacio'],
      ['github', 'gh_cliente_049', 'leo_u', 'Leonardo Uchoa'],
      ['google', 'gg_cliente_050', 'mafalda_w', 'Mafalda West'],
      ['basic', 'basic_cliente_051', 'caio_y', 'Caio Yamada'],
      ['github', 'gh_cliente_052', 'bruna_z', 'Bruna Zamora']
    ];

    clientesExtra.forEach(([provider, provider_id, username, display_name], index) => {
      const email = `${username}@email.pt`;
      usuarios.push({
        provider_id,
        provider,
        username,
        display_name,
        email,
        password_hash: provider === 'basic' ? hashAlt : null,
        role: 'cliente'
      });
    });

    const payload = usuarios.map((u, index) => ({
      ...u,
      api_key: u.api_key || `apikey_${String(index + 1).padStart(3, '0')}_abcdefghijklmnopqrstuvwxyz123456`,
      created_at: now,
      updated_at: now
    }));

    await queryInterface.bulkInsert('utilizadores', payload);
  },
 
  async down(queryInterface) {
    await queryInterface.bulkDelete('utilizadores', null, {});
  }
};
