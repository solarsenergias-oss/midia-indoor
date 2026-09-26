/* ============================================================
   VizzoPlay — Admin App (SPA simples, sem build step)
   ============================================================ */

const API = '/api';

const state = {
  view: 'dashboard',
  telas: [],
  campanhas: [],
  midias: [],
  clientes: [],
  grupos: [],
  rssFeeds: [],
  instagramPerfis: [],
  filtroTelas: 'todas',
  conteudosDinamicosTab: 'yeloo',
  telaDetalheId: null,
  telaDetalhePerfTab: 'mensal',
  telaDetalhePerf: null,
  relatoriosPeriodo: 7,
  whatsappConfig: null,
  whatsappContatos: [],
  whatsappEtiquetas: [],
  whatsappTemplates: [],
  whatsappConversas: [],
  whatsappConversaAtualId: null,
  whatsappCrmView: 'lista',
  whatsappFiltroTag: '',
  whatsappFiltroEtapa: '',
  whatsappBusca: '',
};

/* Etapas do funil de vendas do CRM do WhatsApp (mesma lista do back-end) */
const FUNIL_ETAPAS = ['Novo', 'Em conversa', 'Proposta enviada', 'Fechado', 'Perdido'];

/* Catálogo estático de conteúdos dinâmicos prontos (biblioteca própria, estilo Yeloo) */
const CONTEUDOS_DINAMICOS = {
  yeloo: [
    { grupo: 'Vídeos CINEMA', nome: 'Trailers e novidades' },
    { grupo: 'Vídeos HUMOR', nome: 'Cortes de humor' },
    { grupo: 'Vídeos ESPORTE', nome: 'Melhores momentos' },
  ],
  saude: [
    { grupo: 'Dicas de saúde', nome: 'Hidratação e bem-estar' },
    { grupo: 'Campanhas de vacinação', nome: 'Avisos sazonais' },
  ],
  'datas-sazonais': [
    { grupo: 'Natal', nome: 'Contagem regressiva' },
    { grupo: 'Black Friday', nome: 'Promoções do período' },
  ],
  loterias: [
    { grupo: 'Resultados', nome: 'Mega-Sena / Quina' },
  ],
  diversos: [
    { grupo: 'Curiosidades', nome: 'Fatos do dia' },
    { grupo: 'Frases motivacionais', nome: 'Rotativo diário' },
  ],
};

/* ---------------- Utils ---------------- */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function toast(msg, type = 'success') {
  const c = $('#toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function api(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
    });
    if (res.status === 401) {
      window.location.href = '/login.html';
      return null;
    }
    if (!res.ok) throw new Error('Erro na requisição');
    return await res.json();
  } catch (err) {
    toast('Erro ao comunicar com o servidor', 'error');
    console.error(err);
    return null;
  }
}

async function checkAuth() {
  const user = await fetch('/api/me', { credentials: 'include' });
  if (!user.ok) {
    window.location.href = '/login.html';
    return null;
  }
  return await user.json();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login.html';
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeAgo(d) {
  if (!d) return 'Nunca';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'Agora mesmo';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

/* ---------------- Router ---------------- */
const titles = {
  dashboard: ['Home', 'Dashboard'],
  telas: ['Home', 'Minhas Telas'],
  campanhas: ['Home', 'Campanhas'],
  midias: ['Conteúdos', 'Minhas mídias'],
  grupos: ['Conteúdos', 'Grupos de mídia'],
  'conteudos-dinamicos': ['Conteúdos', 'Conteúdos dinâmicos'],
  instagram: ['Conteúdos', 'Instagram'],
  rss: ['Conteúdos', 'RSS Personalizado'],
  avisos: ['Conteúdos', 'Avisos'],
  utilitarios: ['Conteúdos', 'Utilitários'],
  clientes: ['Home', 'Clientes'],
  relatorios: ['Home', 'Relatórios'],
  'whatsapp-atendimento': ['WhatsApp', 'Atendimento'],
  'whatsapp-crm': ['WhatsApp', 'CRM'],
  'whatsapp-etiquetas': ['WhatsApp', 'Etiquetas'],
  'whatsapp-templates': ['WhatsApp', 'Modelos de mensagem'],
  'whatsapp-metricas': ['WhatsApp', 'Métricas'],
  'whatsapp-config': ['WhatsApp', 'Configurações'],
};

function navigate(view) {
  state.view = view;
  $all('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  const [crumb, title] = titles[view] || ['Home', view];
  $('#breadcrumb').textContent = crumb + ' / ' + title;
  $('#pageTitle').textContent = title;
  render();
}

$all('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(item.dataset.view);
  });
});

/* Alternar tema claro/escuro */
const themeToggle = $('#themeToggle');
if (themeToggle) {
  const savedTheme = localStorage.getItem('midia_indoor_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('midia_indoor_theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}

/* Colapsar/expandir sidebar */
const collapseToggle = $('#collapseToggle');
const sidebarEl = $('#sidebar');
if (collapseToggle && sidebarEl) {
  const isCollapsed = localStorage.getItem('midia_indoor_sidebar_collapsed') === 'true';
  if (isCollapsed) {
    sidebarEl.classList.add('collapsed');
    collapseToggle.title = 'Expandir menu';
  }
  collapseToggle.addEventListener('click', () => {
    const collapsed = sidebarEl.classList.toggle('collapsed');
    collapseToggle.title = collapsed ? 'Expandir menu' : 'Recolher menu';
    localStorage.setItem('midia_indoor_sidebar_collapsed', collapsed);
    if (collapsed) {
      $('#conteudosSubmenu').style.display = 'none';
      $('#whatsappSubmenu').style.display = 'none';
    }
  });
}

/* Dropdown "Conteúdos" */
const conteudosToggle = $('#conteudosToggle');
const conteudosSubmenu = $('#conteudosSubmenu');
const conteudosChevron = $('#conteudosChevron');
if (conteudosToggle) {
  conteudosToggle.addEventListener('click', () => {
    const isOpen = conteudosSubmenu.style.display === 'block';
    conteudosSubmenu.style.display = isOpen ? 'none' : 'block';
    conteudosChevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  });
}

/* Dropdown "WhatsApp" */
const whatsappToggle = $('#whatsappToggle');
const whatsappSubmenu = $('#whatsappSubmenu');
const whatsappChevron = $('#whatsappChevron');
if (whatsappToggle) {
  whatsappToggle.addEventListener('click', () => {
    const isOpen = whatsappSubmenu.style.display === 'block';
    whatsappSubmenu.style.display = isOpen ? 'none' : 'block';
    whatsappChevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  });
}

/* ---------------- Modal helper ---------------- */
function openModal(html) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal">${html}</div>`;
  root.classList.add('open');
  root.onclick = (e) => { if (e.target === root) closeModal(); };
}
function closeModal() {
  $('#modalRoot').classList.remove('open');
  setTimeout(() => $('#modalRoot').innerHTML = '', 150);
}

/* ============================================================
   VIEWS
   ============================================================ */

async function render() {
  const content = $('#content');
  content.innerHTML = '<div class="loader"></div>';
  $('#topbarActions').innerHTML = '';

  switch (state.view) {
    case 'dashboard': return renderDashboard();
    case 'telas': return renderTelas();
    case 'telaDetalhe': return renderTelaDetalhe();
    case 'campanhas': return renderCampanhas();
    case 'midias': return renderMidias();
    case 'grupos': return renderGrupos();
    case 'conteudos-dinamicos': return renderConteudosDinamicos();
    case 'instagram': return renderInstagram();
    case 'rss': return renderRSS();
    case 'avisos': return renderEmConstrucao('🔔', 'Avisos', 'Crie avisos rápidos e urgentes para exibição imediata em todas as telas.');
    case 'utilitarios': return renderEmConstrucao('🧰', 'Utilitários', 'Ferramentas extras: relógio, previsão do tempo, cotações e contadores.');
    case 'clientes': return renderClientes();
    case 'relatorios': return renderRelatorios();
    case 'whatsapp-atendimento': return renderWhatsappAtendimento();
    case 'whatsapp-crm': return renderWhatsappCrm();
    case 'whatsapp-etiquetas': return renderWhatsappEtiquetas();
    case 'whatsapp-templates': return renderWhatsappTemplates();
    case 'whatsapp-metricas': return renderWhatsappMetricas();
    case 'whatsapp-config': return renderWhatsappConfig();
    default: content.innerHTML = '<p>View não encontrada</p>';
  }
}

/* ---------------- Dashboard ---------------- */
async function renderDashboard() {
  const stats = await api('/stats') || { telas_online: 0, telas_offline: 0, telas_total: 0, campanhas_ativas: 0, exibicoes_hoje: 0, desempenho_semana: [0,0,0,0,0,0,0] };
  const content = $('#content');
  const pctOnline = stats.telas_total ? Math.round(stats.telas_online / stats.telas_total * 100) : 0;
  const semana = stats.desempenho_semana || [0,0,0,0,0,0,0];
  const maxSemana = Math.max(1, ...semana);

  const dias = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const meses = ['OUT','NOV','DEZ','JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET'];

  content.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:20px;align-items:stretch;">
      <div class="card">
        <div class="card-header"><span class="card-title">Tempo real</span></div>
        <div class="d-flex" style="gap:28px;">
          <div>
            <span class="status-pill online"><span class="stat-dot online"></span>ONLINE</span>
            <div class="stat-value">${stats.telas_online}</div>
          </div>
          <div>
            <span class="status-pill offline"><span class="stat-dot offline"></span>OFFLINE</span>
            <div class="stat-value">${stats.telas_offline}</div>
          </div>
        </div>
        <p class="text-muted" style="margin:10px 0 16px;font-size:12px;">${pctOnline}% das suas telas estão online</p>
        <div class="card-title" style="font-size:11px;color:var(--text-muted);letter-spacing:.04em;margin-bottom:10px;">DESEMPENHO DAS TELAS</div>
        <div style="display:flex;justify-content:space-between;gap:4px;">
          ${dias.map((d, i) => `
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;">
              <div style="width:100%;height:36px;background:var(--bg);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden;" title="${semana[i]} exibição(ões)">
                <div style="width:100%;height:${Math.round(semana[i] / maxSemana * 100)}%;background:${semana[i] ? 'var(--primary)' : 'transparent'};border-radius:6px 6px 0 0;"></div>
              </div>
              <span style="font-size:10px;color:var(--text-muted);">${d.slice(0,3).toLowerCase()}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Minha rede</span></div>
        <div class="stat-value" style="font-size:26px;">${stats.telas_total}</div>
        <div style="font-size:12px;color:var(--text-muted);margin:2px 0 16px;">tela(s) cadastrada(s)</div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
          ${stats.telas_total ? `${stats.telas_online} online agora` : 'Nenhuma tela cadastrada ainda.'}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Cobertura da rede</span>
          <span class="text-muted" style="cursor:help;" title="Mapa com a localização das suas telas">ⓘ</span>
        </div>
        <div style="background:linear-gradient(135deg,#dbeafe,#e0e7ff);border-radius:var(--radius-sm);height:150px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
          <div style="background:rgba(17,24,39,0.75);color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">
            📍 Em breve...
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:20px;align-items:stretch;">
      <div class="card">
        <div class="card-header"><span class="card-title">Estatísticas e métricas</span></div>
        <div style="display:flex;gap:24px;">
          <div style="flex:1;">
            <svg viewBox="0 0 400 140" style="width:100%;height:140px;">
              <line x1="0" y1="10" x2="400" y2="10" stroke="var(--border)" stroke-dasharray="3,3"/>
              <line x1="0" y1="70" x2="400" y2="70" stroke="var(--border)" stroke-dasharray="3,3"/>
              <line x1="0" y1="130" x2="400" y2="130" stroke="var(--border)"/>
              <polyline points="0,128 36,128 72,128 108,128 145,128 181,128 218,128 254,128 290,128 327,128 363,128 400,128"
                fill="none" stroke="var(--primary)" stroke-width="2.5"/>
            </svg>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:4px;">
              ${meses.map(m => `<span>${m}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Médias por tela</span></div>
        <div class="grid grid-2" style="gap:16px;">
          <div>
            <div class="stat-value" style="font-size:24px;">${stats.exibicoes_hoje}</div>
            <p class="text-muted" style="font-size:12px;">exibições diárias</p>
          </div>
          <div>
            <div class="stat-value" style="font-size:24px;">0h</div>
            <p class="text-muted" style="font-size:12px;">online por dia</p>
          </div>
          <div>
            <div class="stat-value" style="font-size:24px;">0</div>
            <p class="text-muted" style="font-size:12px;">conteúdos na playlist</p>
          </div>
          <div>
            <div class="stat-value" style="font-size:24px;">0min</div>
            <p class="text-muted" style="font-size:12px;">tempo de ciclo</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><span class="card-title">Anotações</span></div>
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">
        <div style="display:flex;align-items:center;gap:4px;padding:8px 10px;background:var(--bg);border-bottom:1px solid var(--border);flex-wrap:wrap;">
          <select class="form-select" style="width:auto;padding:5px 8px;font-size:12px;">
            <option>Normal</option>
            <option>Título</option>
          </select>
          <span style="width:1px;height:20px;background:var(--border);margin:0 4px;"></span>
          <button class="btn-icon" style="font-weight:800;font-size:12px;">H1</button>
          <button class="btn-icon" style="font-weight:800;font-size:12px;">H2</button>
          <span style="width:1px;height:20px;background:var(--border);margin:0 4px;"></span>
          <button class="btn-icon" style="font-weight:800;">B</button>
          <button class="btn-icon" style="font-style:italic;">I</button>
          <button class="btn-icon" style="text-decoration:underline;">U</button>
          <button class="btn-icon" style="text-decoration:line-through;">S</button>
          <span style="width:1px;height:20px;background:var(--border);margin:0 4px;"></span>
          <button class="btn-icon">☰</button>
          <button class="btn-icon">≡</button>
        </div>
        <textarea id="notesArea" placeholder="Use para qualquer anotações úteis..." style="width:100%;min-height:140px;border:none;outline:none;padding:16px;font-family:inherit;font-size:13px;resize:vertical;background:var(--surface);color:var(--text);"></textarea>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:14px;" onclick="saveNotes()">Salvar anotações</button>
    </div>
  `;

  const savedNotes = localStorage.getItem('midia_indoor_notes');
  if (savedNotes) $('#notesArea').value = savedNotes;
}

function saveNotes() {
  localStorage.setItem('midia_indoor_notes', $('#notesArea').value);
  toast('Anotações salvas!');
}

/* ---------------- Telas ---------------- */
const ESTADOS_BR = [
  ['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],
  ['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],
  ['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],
  ['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],
  ['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],
  ['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins'],
];
const DIAS_SEMANA_LABELS = ['D','S','T','Q','Q','S','S'];
const FUSOS_BR = [
  'America/Noronha', 'America/Fortaleza', 'America/Recife', 'America/Sao_Paulo',
  'America/Bahia', 'America/Cuiaba', 'America/Manaus', 'America/Rio_Branco',
];

function telaFormPadrao() {
  return {
    id: null,
    tipo_dispositivo: 'tv_monitor_tablet',
    nome: '', orientacao: 'Horizontal', imagem: null, telefone1: '', telefone2: '',
    endereco: '', numero: '', complemento: '', bairro: '', cep: '', estado: '', cidade: '',
    latitude: null, longitude: null,
    segmento: '', horario_inicio: '', horario_fim: '', dias_semana: [0,1,2,3,4,5,6],
    fluxo_pessoas: '', classes_sociais: [],
    grupo_id: '',
    config: {
      fuso_horario: 'America/Fortaleza', intervalo_atualizacao: 10,
      permitir_som: false,
      imagem_inicializacao_ativo: false, imagem_inicializacao: null,
      exibir_rodape: false, personalizar_config: false,
      rodape_imagem: null, rodape_cor_fundo: '#000000', rodape_cor_fonte: '#ffffff',
      rodape_mensagem_ativo: false, rodape_mensagem: '', rodape_velocidade: 'Lenta',
      rodape_mostrar_data: true, rodape_mostrar_hora: true, rodape_mostrar_clima: false, rodape_mostrar_icones: true,
    },
  };
}

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setNested(obj, path, value) {
  const partes = path.split('.');
  const ultima = partes.pop();
  const alvo = partes.reduce((o, k) => (o[k] = o[k] || {}), obj);
  alvo[ultima] = value;
}

async function renderTelas() {
  state.telas = await api('/telas') || [];
  state.grupos = await api('/grupos') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovaTelaModal()">+ Nova Tela</button>`;

  const filtered = state.telas.filter(t => {
    if (state.filtroTelas === 'online') return t.status === 'online';
    if (state.filtroTelas === 'offline') return t.status !== 'online';
    return true;
  });

  const onlineCount = state.telas.filter(t => t.status === 'online').length;
  const offlineCount = state.telas.length - onlineCount;

  const rows = filtered.map(t => {
    const total = state.grupos.reduce((acc, g) => {
      const telasIds = JSON.parse(g.telas_ids || '[]');
      return telasIds.includes(t.id) ? acc + JSON.parse(g.midias_ids || '[]').length : acc;
    }, 0);
    const baixadas = Math.min(t.midias_baixadas_ok || 0, total);
    const completo = total > 0 && baixadas >= total;
    const emUso = t.disponibilidade === 'em_uso';
    return `
    <tr>
      <td>
        <div class="tela-row-link" onclick="abrirDetalheTela(${t.id})">
          <div class="tela-thumb">${t.imagem ? `<img src="${t.imagem}" alt="">` : '🖼️'}</div>
          <div><strong>${t.nome}</strong><div class="text-muted" style="font-size:11px;">${t.segmento || t.localizacao || t.cidade || '—'}</div></div>
        </div>
      </td>
      <td><span class="status-pill ${emUso ? 'active' : 'online'}">${emUso ? '🖥️ Em uso' : '🖥️ Disponível'}</span></td>
      <td><span class="midias-baixadas-badge ${completo ? 'completo' : ''}">${baixadas}/${total || 0} ${completo ? '✓' : '🕒'}</span></td>
      <td>${timeAgo(t.ultima_comunicacao)}</td>
      <td>
        <div class="action-icons">
          <button title="Ver detalhes" onclick="abrirDetalheTela(${t.id})">👁️</button>
          <button title="Editar" onclick="editTela(${t.id})">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteTela(${t.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  $('#content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="filter-chips">
          <div class="chip ${state.filtroTelas === 'online' ? 'active' : ''}" onclick="setFiltroTelas('online')">🟢 Online <span class="count">${onlineCount}</span></div>
          <div class="chip ${state.filtroTelas === 'offline' ? 'active' : ''}" onclick="setFiltroTelas('offline')">⚪ Offline <span class="count">${offlineCount}</span></div>
          <div class="chip ${state.filtroTelas === 'todas' ? 'active' : ''}" onclick="setFiltroTelas('todas')">📋 Todas <span class="count">${state.telas.length}</span></div>
        </div>
      </div>
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="icon">📺</div>
          <h4>Nenhuma tela cadastrada</h4>
          <p>Clique em "Nova Tela" para conectar seu primeiro TV Box e começar a exibir campanhas.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Tela</th><th>Disponibilidade</th><th>Mídias baixadas</th><th>Última comunicação</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

/* ---------------- Detalhe da tela ---------------- */
async function abrirDetalheTela(id) {
  state.view = 'telaDetalhe';
  state.telaDetalheId = id;
  state.telaDetalhePerfTab = 'mensal';
  state.telaDetalhePerf = null;
  $all('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'telas'));
  render();
}

function voltarParaTelas() {
  navigate('telas');
}

async function renderTelaDetalhe() {
  const tela = await api(`/telas/${state.telaDetalheId}`);
  if (!tela) { navigate('telas'); return; }
  state.grupos = await api('/grupos') || [];
  const comandos = await api(`/telas/${tela.id}/comandos`) || [];
  state.telaDetalhePerf = state.telaDetalhePerf || await api(`/telas/${tela.id}/desempenho`) || { diario: [0,0,0,0,0,0,0], mensal: Array(12).fill(0) };

  $('#breadcrumb').textContent = 'Home / Minhas telas / ' + tela.nome;
  $('#pageTitle').textContent = tela.nome;
  $('#topbarActions').innerHTML = `<button class="btn btn-secondary" onclick="voltarParaTelas()">← Voltar</button>`;

  const online = tela.status === 'online';
  const emUso = tela.disponibilidade === 'em_uso';
  const totalVinculadas = state.grupos.reduce((acc, g) => {
    const telasIds = JSON.parse(g.telas_ids || '[]');
    return telasIds.includes(tela.id) ? acc + JSON.parse(g.midias_ids || '[]').length : acc;
  }, 0);

  $('#content').innerHTML = `
    <div class="tela-detalhe-header">
      <div class="tela-thumb">${tela.imagem ? `<img src="${tela.imagem}" alt="">` : '🖼️'}</div>
      <div class="info">
        <div class="categoria">${tela.segmento || tela.localizacao || '—'}</div>
        <h2>${tela.nome}</h2>
        <div class="meta">
          <span>${tela.orientacao === 'Vertical' ? '📱 Vertical' : '🖥️ Horizontal'}</span>
          <span>·</span>
          <span class="status-pill ${online ? 'online' : 'offline'}">${online ? 'Online agora' : 'Offline'}</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="favorito ${tela.favorito ? 'active' : ''}" title="Favoritar" onclick="toggleFavoritoTela(${tela.id}, ${tela.favorito ? 0 : 1})">⭐</button>
        <button title="Ver no mapa" onclick="verNoMapaTela(${tela.latitude || 'null'}, ${tela.longitude || 'null'})">📍</button>
        <button title="Baixar relatório" onclick="baixarRelatorioTela(${tela.id})">⬇️</button>
        <button title="Histórico de comandos" onclick="abrirHistoricoComandos(${tela.id})">📄</button>
        <button title="Editar" onclick="editTela(${tela.id})">✏️</button>
        <button class="danger" title="${tela.status_tela === 'desativado' ? 'Ativar tela' : 'Desativar tela'}" onclick="excluirTelaDetalhe(${tela.id})">🗑️</button>
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start;">
      <div>
        <div class="d-flex justify-between align-center" style="margin-bottom:12px;">
          <span class="text-muted" style="font-size:12px;">${tela.orientacao || 'Horizontal'} · ${online ? 'Online agora' : 'Offline'}</span>
          <button class="btn btn-primary btn-sm" onclick="abrirPlaylistTela(${tela.id})">☰ Playlist</button>
        </div>
        <div class="tela-preview">
          ${online ? `<div class="live-dot"><span class="dot"></span> ONLINE</div>` : ''}
          ${tela.ultima_midia_url
            ? (tela.ultima_midia_tipo === 'video'
                ? `<video src="${tela.ultima_midia_url}" muted autoplay loop playsinline></video>`
                : `<img src="${tela.ultima_midia_url}" alt="">`)
            : `<div class="placeholder">${online ? 'Aguardando a próxima exibição…' : 'Tela offline — sem prévia disponível'}</div>`}
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Comandos remotos</span>
            <button class="btn btn-primary btn-sm" onclick="abrirEnviarComandoModal(${tela.id})">+ Enviar comando</button>
          </div>
          <div class="comando-list">
            ${comandos.length === 0 ? '<p class="text-muted" style="font-size:12px;">Nenhum comando enviado ainda.</p>' : comandos.map(c => `
              <div class="comando-item">
                <div><div class="nome">${COMANDOS_LABELS[c.comando] || c.comando}</div><div class="quando">${timeAgo(c.criado_em)}</div></div>
                <span class="status-pill ${c.status === 'concluido' ? 'active' : c.status === 'enviado' ? 'paused' : 'offline'}">${COMANDO_STATUS_LABELS[c.status] || c.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:20px;">
          <div class="perf-tabs">
            <button class="${state.telaDetalhePerfTab === 'mensal' ? 'active' : ''}" onclick="mudarPerfTab('mensal')">Mensal</button>
            <button class="${state.telaDetalhePerfTab === 'diario' ? 'active' : ''}" onclick="mudarPerfTab('diario')">Diário</button>
          </div>
          <div id="perfChartWrap">${renderPerfChart()}</div>
          <div class="text-muted" style="font-size:11px;margin-top:8px;">DESEMPENHO DA TELA</div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><span class="card-title">Dispositivo</span></div>
          <div class="device-info-grid">
            <div class="item"><div class="lbl">📱 Modelo</div><div class="val ${!tela.modelo ? 'muted' : ''}">${tela.modelo || '(Não disponível)'}</div></div>
            <div class="item"><div class="lbl">⚙️ Processador</div><div class="val ${!tela.processador ? 'muted' : ''}">${tela.processador || '(Não disponível)'}</div></div>
            <div class="item"><div class="lbl">🤖 Versão Android</div><div class="val ${!tela.versao_android ? 'muted' : ''}">${tela.versao_android || '(Não disponível)'}</div></div>
            <div class="item"><div class="lbl">🔓 Rooteado</div><div class="val">${tela.rooteado ? 'Sim' : 'Não'}</div></div>
            <div class="item"><div class="lbl">📦 Versão APP</div><div class="val ${!tela.versao_app ? 'muted' : ''}">${tela.versao_app || '(Não disponível)'}</div></div>
            <div class="item"><div class="lbl">💾 Uso de memória</div><div class="val ${!tela.uso_memoria_mb ? 'muted' : ''}">${tela.uso_memoria_mb ? tela.uso_memoria_mb.toFixed(2) + ' MB' : '(Não disponível)'}</div></div>
            <div class="item"><div class="lbl">🖼️ Orientação</div><div class="val">${tela.orientacao || 'Horizontal'}</div></div>
            <div class="item"><div class="lbl">🎞️ Mídias vinculadas</div><div class="val">${totalVinculadas}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Anotações</span></div>
          <div class="notes-toolbar">
            <select disabled><option>Normal</option></select>
            <button type="button" title="Negrito"><b>B</b></button>
            <button type="button" title="Itálico"><i>I</i></button>
            <button type="button" title="Sublinhado"><u>U</u></button>
            <button type="button" title="Lista">≡</button>
          </div>
          <textarea id="telaAnotacoes" class="notes-textarea" placeholder="Use para qualquer anotações úteis...">${tela.anotacoes || ''}</textarea>
          <button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="salvarAnotacoesTela(${tela.id})">Salvar anotações</button>
        </div>
      </div>
    </div>
  `;
}

const COMANDOS_LABELS = {
  reiniciar_app: 'Reiniciar app',
  atualizar_midias: 'Atualizar mídias agora',
  reiniciar_dispositivo: 'Reiniciar dispositivo',
};
const COMANDO_STATUS_LABELS = { pendente: 'Pendente', enviado: 'Enviado', concluido: 'Concluído' };

function renderPerfChart() {
  const perf = state.telaDetalhePerf || { diario: [0,0,0,0,0,0,0], mensal: Array(12).fill(0) };
  if (state.telaDetalhePerfTab === 'diario') {
    const dias = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
    const dados = perf.diario;
    const max = Math.max(1, ...dados);
    return `<div class="perf-bars">${dias.map((d, i) => `
      <div class="bar-col">
        <div class="bar"><div class="fill" style="height:${Math.round(dados[i] / max * 100)}%;"></div></div>
        <div class="lbl">${d.slice(0,3).toLowerCase()}</div>
      </div>`).join('')}</div>`;
  }
  const meses = ['OUT','NOV','DEZ','JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET'];
  const dados = perf.mensal;
  const max = Math.max(1, ...dados);
  return `<div class="perf-bars">${meses.map((m, i) => `
    <div class="bar-col">
      <div class="bar"><div class="fill" style="height:${Math.round(dados[i] / max * 100)}%;"></div></div>
      <div class="lbl">${m}</div>
    </div>`).join('')}</div>`;
}

function mudarPerfTab(tab) {
  state.telaDetalhePerfTab = tab;
  $('#perfChartWrap').innerHTML = renderPerfChart();
  $all('.perf-tabs button').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === tab));
}

async function toggleFavoritoTela(id, valor) {
  await api(`/telas/${id}`, { method: 'PUT', body: JSON.stringify({ favorito: valor }) });
  renderTelaDetalhe();
}

function verNoMapaTela(lat, lng) {
  if (!lat || !lng) { toast('Esta tela não tem localização cadastrada', 'error'); return; }
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

function baixarRelatorioTela(id) {
  window.open(`${API}/telas/${id}/relatorio.csv`, '_blank');
}

async function excluirTelaDetalhe(id) {
  if (!confirm('Excluir esta tela? Essa ação não pode ser desfeita.')) return;
  await api(`/telas/${id}`, { method: 'DELETE' });
  toast('Tela excluída');
  navigate('telas');
}

function abrirHistoricoComandos(id) {
  toast('O histórico completo aparece na seção "Comandos remotos" abaixo');
}

async function abrirPlaylistTela(telaId) {
  const grupos = state.grupos.filter(g => JSON.parse(g.telas_ids || '[]').includes(telaId));
  const midiaIds = new Set();
  grupos.forEach(g => JSON.parse(g.midias_ids || '[]').forEach(id => midiaIds.add(id)));
  state.midias = await api('/midias') || [];
  const midias = state.midias.filter(m => midiaIds.has(m.id));

  openModal(`
    <div class="modal-header"><h3>Playlist desta tela</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      ${midias.length === 0 ? '<p class="text-muted">Nenhuma mídia vinculada. Vá em "Vincular telas" para adicionar.</p>' : midias.map(m => `
        <div class="playlist-item">
          <span>${m.tipo === 'video' ? '🎬' : '🖼️'} ${m.nome}</span>
          <span class="text-muted">${m.duracao_segundos || 10}s</span>
        </div>
      `).join('')}
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
  `);
}

function abrirEnviarComandoModal(telaId) {
  openModal(`
    <div class="modal-header"><h3>Enviar comando</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="select-cards" style="grid-template-columns:1fr;">
        <div class="select-card" style="cursor:pointer;text-align:left;padding:14px;" onclick="enviarComandoTela(${telaId}, 'atualizar_midias')">🔄 Atualizar mídias agora</div>
        <div class="select-card" style="cursor:pointer;text-align:left;padding:14px;" onclick="enviarComandoTela(${telaId}, 'reiniciar_app')">♻️ Reiniciar app</div>
        <div class="select-card" style="cursor:pointer;text-align:left;padding:14px;" onclick="enviarComandoTela(${telaId}, 'reiniciar_dispositivo')">🔌 Reiniciar dispositivo</div>
      </div>
    </div>
  `);
}

async function enviarComandoTela(telaId, comando) {
  await api(`/telas/${telaId}/comandos`, { method: 'POST', body: JSON.stringify({ comando }) });
  closeModal();
  toast('Comando enviado — será executado assim que a tela sincronizar');
  renderTelaDetalhe();
}

async function salvarAnotacoesTela(id) {
  const anotacoes = document.getElementById('telaAnotacoes')?.value || '';
  await api(`/telas/${id}`, { method: 'PUT', body: JSON.stringify({ anotacoes }) });
  toast('Anotações salvas');
}

function setFiltroTelas(f) { state.filtroTelas = f; renderTelas(); }

/* ---------------- Nova Tela: escolha do tipo ---------------- */
function openNovaTelaModal() {
  openModal(`
    <div class="modal-header">
      <h3>Nova Tela</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="select-cards">
        <div class="select-card" style="cursor:pointer;" onclick="escolherTipoTela('tv_monitor_tablet')">
          <div style="font-size:26px;margin-bottom:8px;">📺</div>TV, monitor, tablet
        </div>
        <div class="select-card" style="cursor:pointer;" onclick="escolherTipoTela('painel_led')">
          <div style="font-size:26px;margin-bottom:8px;">🔲</div>Painel LED
        </div>
      </div>
    </div>
  `);
}

function escolherTipoTela(tipo) {
  state.telaForm = telaFormPadrao();
  state.telaForm.tipo_dispositivo = tipo;
  abrirTelaFormModal('info');
}

function editTela(id) {
  const tela = state.telas.find(t => t.id === id);
  if (!tela) return;
  const padrao = telaFormPadrao();
  let config = padrao.config;
  try { config = { ...padrao.config, ...JSON.parse(tela.config || '{}') }; } catch (e) {}
  state.telaForm = {
    ...padrao,
    id: tela.id,
    tipo_dispositivo: tela.tipo_dispositivo || 'tv_monitor_tablet',
    nome: tela.nome || '', orientacao: tela.orientacao || 'Horizontal', imagem: tela.imagem || null,
    telefone1: tela.telefone1 || '', telefone2: tela.telefone2 || '',
    endereco: tela.endereco || '', numero: tela.numero || '', complemento: tela.complemento || '',
    bairro: tela.bairro || '', cep: tela.cep || '', estado: tela.estado || '', cidade: tela.cidade || '',
    latitude: tela.latitude || null, longitude: tela.longitude || null,
    segmento: tela.segmento || '', horario_inicio: tela.horario_inicio || '', horario_fim: tela.horario_fim || '',
    dias_semana: (tela.dias_semana || '0,1,2,3,4,5,6').split(',').filter(Boolean).map(Number),
    fluxo_pessoas: tela.fluxo_pessoas || '',
    classes_sociais: (() => { try { return JSON.parse(tela.classes_sociais || '[]'); } catch (e) { return []; } })(),
    grupo_id: tela.grupo_id || '',
    config,
  };
  abrirTelaFormModal('info');
}

/* ---------------- Formulário com abas ---------------- */
function capturarAbaAtual(aba) {
  const f = state.telaForm;
  if (aba === 'info') {
    f.nome = document.getElementById('telaNome')?.value ?? f.nome;
    f.telefone1 = document.getElementById('telaTelefone1')?.value ?? f.telefone1;
    f.telefone2 = document.getElementById('telaTelefone2')?.value ?? f.telefone2;
  } else if (aba === 'localizacao') {
    f.endereco = document.getElementById('telaEndereco')?.value ?? f.endereco;
    f.numero = document.getElementById('telaNumero')?.value ?? f.numero;
    f.complemento = document.getElementById('telaComplemento')?.value ?? f.complemento;
    f.bairro = document.getElementById('telaBairro')?.value ?? f.bairro;
    f.cep = document.getElementById('telaCep')?.value ?? f.cep;
    f.estado = document.getElementById('telaEstado')?.value ?? f.estado;
    f.cidade = document.getElementById('telaCidade')?.value ?? f.cidade;
  } else if (aba === 'metricas') {
    f.segmento = document.getElementById('telaSegmento')?.value ?? f.segmento;
    f.horario_inicio = document.getElementById('telaHoraInicio')?.value ?? f.horario_inicio;
    f.horario_fim = document.getElementById('telaHoraFim')?.value ?? f.horario_fim;
    f.fluxo_pessoas = document.getElementById('telaFluxoPessoas')?.value ?? f.fluxo_pessoas;
  } else if (aba === 'configuracoes') {
    f.config.fuso_horario = document.getElementById('telaFusoHorario')?.value ?? f.config.fuso_horario;
    f.config.intervalo_atualizacao = document.getElementById('telaIntervalo')?.value ?? f.config.intervalo_atualizacao;
    f.config.rodape_mensagem = document.getElementById('telaRodapeMensagem')?.value ?? f.config.rodape_mensagem;
    f.config.rodape_velocidade = document.getElementById('telaRodapeVelocidade')?.value ?? f.config.rodape_velocidade;
    f.config.rodape_cor_fundo = document.getElementById('telaRodapeCorFundo')?.value ?? f.config.rodape_cor_fundo;
    f.config.rodape_cor_fonte = document.getElementById('telaRodapeCorFonte')?.value ?? f.config.rodape_cor_fonte;
  }
}

function mudarAbaTela(abaAtual, novaAba) {
  capturarAbaAtual(abaAtual);
  abrirTelaFormModal(novaAba);
}

function fecharTelaForm() {
  if (telaMapaInstancia) { telaMapaInstancia.remove(); telaMapaInstancia = null; }
  closeModal();
}

let telaMapaInstancia = null;
let telaMarcadorInstancia = null;

function abrirTelaFormModal(aba) {
  const f = state.telaForm;
  const abas = [
    ['info', 'ⓘ Info'],
    ['localizacao', '📍 Localização'],
    ['metricas', '📶 Métricas'],
    ['configuracoes', '⚙️ Configurações'],
  ];

  openModal(`
    <div class="modal-header">
      <h3>${f.id ? 'Editar Tela' : 'Nova Tela'}</h3>
      <button class="modal-close" onclick="fecharTelaForm()">✕</button>
    </div>
    <div class="modal-tabs">
      ${abas.map(([key, label]) => `<div class="modal-tab ${aba === key ? 'active' : ''}" onclick="mudarAbaTela('${aba}', '${key}')">${label}</div>`).join('')}
    </div>
    <div class="modal-body" id="telaFormBody">${renderTelaAba(aba)}</div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharTelaForm()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarTelaForm('${aba}')">💾 Salvar</button>
    </div>
  `);

  if (aba === 'localizacao') setTimeout(() => initMapaTela(), 30);
  if (aba === 'localizacao' && f.estado) carregarCidades(f.estado, f.cidade);
}

function renderTelaAba(aba) {
  const f = state.telaForm;
  if (aba === 'info') {
    return `
      <div class="form-group">
        <label class="form-label">Orientação</label>
        <div class="select-cards">
          <div class="select-card ${f.orientacao === 'Horizontal' ? 'selected' : ''}" style="cursor:pointer;padding:16px;" onclick="capturarAbaAtual('info'); state.telaForm.orientacao='Horizontal'; abrirTelaFormModal('info')">🖥️ Horizontal</div>
          <div class="select-card ${f.orientacao === 'Vertical' ? 'selected' : ''}" style="cursor:pointer;padding:16px;" onclick="capturarAbaAtual('info'); state.telaForm.orientacao='Vertical'; abrirTelaFormModal('info')">📱 Vertical</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Imagem</label>
        ${f.imagem ? `<img src="${f.imagem}" style="max-height:80px;border-radius:8px;display:block;margin-bottom:8px;">` : ''}
        <label class="upload-box" style="cursor:pointer;display:block;">
          📤 ${f.imagem ? 'Trocar arquivo...' : 'Escolher arquivo...'}
          <input type="file" accept="image/*" style="display:none;" onchange="onUploadTelaImagem(this, 'imagem', 'info')">
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Nome</label>
        <input class="form-input" id="telaNome" value="${f.nome}" placeholder="Ex: TV Loja Centro" required>
      </div>
      <div class="form-group">
        <label class="form-label">Vincular a um grupo (opcional)</label>
        <select class="form-select" id="telaGrupoId" onchange="state.telaForm.grupo_id = this.value">
          <option value="">Nenhum</option>
          ${state.grupos.map(g => `<option value="${g.id}" ${String(f.grupo_id) === String(g.id) ? 'selected' : ''}>${g.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Telefone #1</label>
          <input class="form-input" id="telaTelefone1" value="${f.telefone1}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefone #2</label>
          <input class="form-input" id="telaTelefone2" value="${f.telefone2}">
        </div>
      </div>
    `;
  }
  if (aba === 'localizacao') {
    return `
      <div class="map-tela" id="mapTela"></div>
      <p class="form-hint" style="margin-top:-8px;margin-bottom:14px;">Arraste o pino para definir a localização mais precisa da tela.</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Endereço</label>
          <input class="form-input" id="telaEndereco" value="${f.endereco}" placeholder="Ex: Avenida Brasil">
        </div>
        <div class="form-group">
          <label class="form-label">Número</label>
          <input class="form-input" id="telaNumero" value="${f.numero}" placeholder="Nº 123">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Complemento</label>
        <input class="form-input" id="telaComplemento" value="${f.complemento}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Bairro</label>
          <input class="form-input" id="telaBairro" value="${f.bairro}">
        </div>
        <div class="form-group">
          <label class="form-label">CEP</label>
          <input class="form-input" id="telaCep" value="${f.cep}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-select" id="telaEstado" onchange="state.telaForm.estado = this.value; state.telaForm.cidade=''; carregarCidades(this.value)">
            <option value="">Selecione</option>
            ${ESTADOS_BR.map(([sigla, nome]) => `<option value="${sigla}" ${f.estado === sigla ? 'selected' : ''}>${nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Cidade</label>
          <select class="form-select" id="telaCidade">
            <option value="">${f.estado ? 'Carregando...' : 'Selecione o estado primeiro'}</option>
          </select>
        </div>
      </div>
    `;
  }
  if (aba === 'metricas') {
    return `
      <div class="form-group">
        <label class="form-label">Segmento</label>
        <select class="form-select" id="telaSegmento">
          <option value="">Selecione</option>
          ${['Loja', 'Restaurante', 'Academia', 'Farmácia', 'Supermercado', 'Salão de beleza', 'Consultório', 'Outro']
            .map(s => `<option value="${s}" ${f.segmento === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Horário de funcionamento</label>
        <div class="form-row">
          <input class="form-input" type="time" id="telaHoraInicio" value="${f.horario_inicio}">
          <input class="form-input" type="time" id="telaHoraFim" value="${f.horario_fim}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Dias da semana</label>
        <div class="week-selector">
          ${DIAS_SEMANA_LABELS.map((d, i) => `<div class="day-chip selectable ${f.dias_semana.includes(i) ? 'active' : ''}" onclick="toggleDiaSemanaTela(${i})">${d}</div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Fluxo de pessoas</label>
        <input class="form-input" type="number" min="0" id="telaFluxoPessoas" value="${f.fluxo_pessoas}" placeholder="Quantidade média de pessoas que circulam no local por dia">
        <p class="form-hint">Quantidade média de pessoas que circulam no local por dia</p>
      </div>
      <div class="form-group">
        <label class="form-label">Classes sociais</label>
        <div style="display:flex;gap:8px;">
          ${['A','B','C','D'].map(c => `<div class="class-chip ${f.classes_sociais.includes(c) ? 'active' : ''}" onclick="toggleClasseSocialTela('${c}')">${c}</div>`).join('')}
        </div>
      </div>
    `;
  }
  // configuracoes
  const c = f.config;
  return `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Fuso horário</label>
        <select class="form-select" id="telaFusoHorario">
          ${FUSOS_BR.map(tz => `<option value="${tz}" ${c.fuso_horario === tz ? 'selected' : ''}>${tz}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Verificar atualizações a cada</label>
        <select class="form-select" id="telaIntervalo">
          ${[5,10,15,30,60].map(m => `<option value="${m}" ${Number(c.intervalo_atualizacao) === m ? 'selected' : ''}>${m} minutos</option>`).join('')}
        </select>
        <p class="form-hint">Intervalo recorrente que a tela consulta atualizações</p>
      </div>
    </div>

    <div class="switch-row">
      <div>
        <div class="switch-label">Permitir som</div>
        <div class="switch-hint">Permite som na reprodução das mídias</div>
      </div>
      <label class="switch"><input type="checkbox" ${c.permitir_som ? 'checked' : ''} onchange="toggleConfigTela('permitir_som', this.checked)"><span class="slider"></span></label>
    </div>

    <div class="switch-row">
      <div>
        <div class="switch-label">Personalizar imagem de inicialização</div>
        <div class="switch-hint">Ative para personalizar a imagem exibida na tela de inicialização/carregamento do aplicativo.</div>
      </div>
      <label class="switch"><input type="checkbox" ${c.imagem_inicializacao_ativo ? 'checked' : ''} onchange="toggleConfigTela('imagem_inicializacao_ativo', this.checked)"><span class="slider"></span></label>
    </div>
    ${c.imagem_inicializacao_ativo ? `
      <div class="form-group">
        <label class="form-label">Imagem de inicialização</label>
        ${c.imagem_inicializacao ? `<img src="${c.imagem_inicializacao}" style="max-height:80px;border-radius:8px;display:block;margin-bottom:8px;">` : ''}
        <label class="upload-box" style="cursor:pointer;display:block;">
          📤 Escolher arquivo...
          <input type="file" accept="image/*" style="display:none;" onchange="onUploadTelaImagem(this, 'config.imagem_inicializacao', 'configuracoes')">
        </label>
      </div>
    ` : ''}

    <div class="switch-row">
      <div>
        <div class="switch-label">Exibir rodapé</div>
        <div class="switch-hint">Mostra uma faixa com informações no rodapé da tela</div>
      </div>
      <label class="switch"><input type="checkbox" ${c.exibir_rodape ? 'checked' : ''} onchange="toggleConfigTela('exibir_rodape', this.checked)"><span class="slider"></span></label>
    </div>
    ${c.exibir_rodape ? `
      <div class="switch-row">
        <div>
          <div class="switch-label">Personalizar configuração</div>
          <div class="switch-hint">Usa a configuração padrão ou define configurações personalizadas</div>
        </div>
        <label class="switch"><input type="checkbox" ${c.personalizar_config ? 'checked' : ''} onchange="toggleConfigTela('personalizar_config', this.checked)"><span class="slider"></span></label>
      </div>
    ` : ''}
    ${c.exibir_rodape && c.personalizar_config ? `
      <div class="form-group">
        <label class="form-label">Imagem</label>
        ${c.rodape_imagem ? `<img src="${c.rodape_imagem}" style="max-height:60px;border-radius:8px;display:block;margin-bottom:8px;">` : ''}
        <label class="upload-box" style="cursor:pointer;display:block;">
          📤 Escolher arquivo...
          <input type="file" accept="image/*" style="display:none;" onchange="onUploadTelaImagem(this, 'config.rodape_imagem', 'configuracoes')">
        </label>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cor de fundo</label>
          <input class="form-input" type="color" id="telaRodapeCorFundo" value="${c.rodape_cor_fundo}">
        </div>
        <div class="form-group">
          <label class="form-label">Cor da fonte</label>
          <input class="form-input" type="color" id="telaRodapeCorFonte" value="${c.rodape_cor_fonte}">
        </div>
      </div>
      <div class="switch-row">
        <div class="switch-label">Mensagem</div>
        <label class="switch"><input type="checkbox" ${c.rodape_mensagem_ativo ? 'checked' : ''} onchange="toggleConfigTela('rodape_mensagem_ativo', this.checked)"><span class="slider"></span></label>
      </div>
      ${c.rodape_mensagem_ativo ? `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Mensagem</label>
            <input class="form-input" id="telaRodapeMensagem" value="${c.rodape_mensagem}" maxlength="110">
            <p class="form-hint">Tamanho máximo: 110 caracteres</p>
          </div>
          <div class="form-group">
            <label class="form-label">Velocidade da mensagem</label>
            <select class="form-select" id="telaRodapeVelocidade">
              ${['Lenta','Média','Rápida'].map(v => `<option value="${v}" ${c.rodape_velocidade === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
      ` : ''}
      <div class="form-row">
        <div class="switch-row">
          <div class="switch-label">Data</div>
          <label class="switch"><input type="checkbox" ${c.rodape_mostrar_data ? 'checked' : ''} onchange="toggleConfigTela('rodape_mostrar_data', this.checked)"><span class="slider"></span></label>
        </div>
        <div class="switch-row">
          <div class="switch-label">Hora</div>
          <label class="switch"><input type="checkbox" ${c.rodape_mostrar_hora ? 'checked' : ''} onchange="toggleConfigTela('rodape_mostrar_hora', this.checked)"><span class="slider"></span></label>
        </div>
      </div>
      <div class="form-row">
        <div class="switch-row">
          <div>
            <div class="switch-label">Clima</div>
            <div class="switch-hint">Requer configurar uma chave de previsão do tempo depois</div>
          </div>
          <label class="switch"><input type="checkbox" ${c.rodape_mostrar_clima ? 'checked' : ''} onchange="toggleConfigTela('rodape_mostrar_clima', this.checked)"><span class="slider"></span></label>
        </div>
        <div class="switch-row">
          <div class="switch-label">Ícones</div>
          <label class="switch"><input type="checkbox" ${c.rodape_mostrar_icones ? 'checked' : ''} onchange="toggleConfigTela('rodape_mostrar_icones', this.checked)"><span class="slider"></span></label>
        </div>
      </div>
    ` : ''}
  `;
}

function toggleDiaSemanaTela(dia) {
  capturarAbaAtual('metricas');
  const f = state.telaForm;
  f.dias_semana = f.dias_semana.includes(dia) ? f.dias_semana.filter(d => d !== dia) : [...f.dias_semana, dia];
  $('#telaFormBody').innerHTML = renderTelaAba('metricas');
}

function toggleClasseSocialTela(c) {
  capturarAbaAtual('metricas');
  const f = state.telaForm;
  f.classes_sociais = f.classes_sociais.includes(c) ? f.classes_sociais.filter(x => x !== c) : [...f.classes_sociais, c];
  $('#telaFormBody').innerHTML = renderTelaAba('metricas');
}

function toggleConfigTela(campo, valor) {
  capturarAbaAtual('configuracoes');
  state.telaForm.config[campo] = valor;
  $('#telaFormBody').innerHTML = renderTelaAba('configuracoes');
}

async function onUploadTelaImagem(inputEl, caminho, aba) {
  const file = inputEl.files[0];
  if (!file) return;
  capturarAbaAtual(aba);
  const fd = new FormData();
  fd.append('arquivo', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) throw new Error('Falha no upload');
    const uploaded = await res.json();
    setNested(state.telaForm, caminho, uploaded.url);
    $('#telaFormBody').innerHTML = renderTelaAba(aba);
    toast('Imagem enviada!');
  } catch (err) {
    toast('Erro ao enviar imagem', 'error');
  }
}

function initMapaTela() {
  const el = document.getElementById('mapTela');
  if (!el || typeof L === 'undefined') return;
  if (telaMapaInstancia) { telaMapaInstancia.remove(); telaMapaInstancia = null; }

  const f = state.telaForm;
  const lat = f.latitude || -3.7327, lng = f.longitude || -40.9847; // padrão: Viçosa do Ceará
  telaMapaInstancia = L.map('mapTela').setView([lat, lng], f.latitude ? 15 : 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(telaMapaInstancia);

  telaMarcadorInstancia = L.marker([lat, lng], { draggable: true }).addTo(telaMapaInstancia);
  telaMarcadorInstancia.on('dragend', async () => {
    const pos = telaMarcadorInstancia.getLatLng();
    state.telaForm.latitude = pos.lat;
    state.telaForm.longitude = pos.lng;
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`);
      const dados = await resp.json();
      const addr = dados.address || {};
      if (document.getElementById('telaEndereco')) document.getElementById('telaEndereco').value = addr.road || '';
      if (document.getElementById('telaBairro')) document.getElementById('telaBairro').value = addr.suburb || addr.neighbourhood || '';
      if (document.getElementById('telaCep')) document.getElementById('telaCep').value = addr.postcode || '';
    } catch (e) { /* geocoding é best-effort */ }
  });

  if (!f.latitude) {
    state.telaForm.latitude = lat;
    state.telaForm.longitude = lng;
  }
}

async function carregarCidades(uf, cidadeSelecionada) {
  const select = document.getElementById('telaCidade');
  if (!select) return;
  if (!uf) { select.innerHTML = '<option value="">Selecione o estado primeiro</option>'; return; }
  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    const resp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
    const cidades = await resp.json();
    select.innerHTML = `<option value="">Selecione</option>` +
      cidades.map(c => `<option value="${c.nome}" ${cidadeSelecionada === c.nome ? 'selected' : ''}>${c.nome}</option>`).join('');
    select.onchange = () => { state.telaForm.cidade = select.value; };
  } catch (e) {
    select.innerHTML = '<option value="">Não foi possível carregar</option>';
  }
}

async function salvarTelaForm(abaAtual) {
  capturarAbaAtual(abaAtual);
  const f = state.telaForm;
  if (!f.nome || !f.nome.trim()) { toast('Informe o nome da tela', 'error'); return; }

  const payload = {
    ...f,
    localizacao: f.cidade && f.estado ? `${f.cidade} - ${f.estado}` : (f.endereco || ''),
    grupo_id: f.grupo_id || null,
  };

  const result = f.id
    ? await api(`/telas/${f.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await api('/telas', { method: 'POST', body: JSON.stringify(payload) });

  if (result) {
    toast(f.id ? 'Tela atualizada!' : 'Tela cadastrada com sucesso!');
    if (telaMapaInstancia) { telaMapaInstancia.remove(); telaMapaInstancia = null; }
    closeModal();
    renderTelas();
  }
}

async function deleteTela(id) {
  if (!confirm('Deseja realmente excluir esta tela?')) return;
  const result = await api(`/telas/${id}`, { method: 'DELETE' });
  if (result) { toast('Tela removida'); renderTelas(); }
}

/* ---------------- Campanhas ---------------- */
async function renderCampanhas() {
  state.campanhas = await api('/campanhas') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovaCampanhaModal()">+ Nova Campanha</button>`;

  const rows = state.campanhas.map(c => `
    <tr>
      <td><strong>${c.nome}</strong><div class="text-muted" style="font-size:11px;">${c.descricao || ''}</div></td>
      <td><span class="status-pill ${c.status === 'ativa' ? 'active' : c.status === 'pausada' ? 'paused' : 'ended'}">${c.status}</span></td>
      <td>${fmtDate(c.criado_em)}</td>
      <td>
        <div class="action-icons">
          <button title="Editar" onclick="toast('Em breve')">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteCampanha(${c.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    <div class="table-wrap">
      ${state.campanhas.length === 0 ? `
        <div class="empty-state">
          <div class="icon">📢</div>
          <h4>Nenhuma campanha criada</h4>
          <p>Crie sua primeira campanha publicitária para começar a exibir conteúdo nas telas.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Campanha</th><th>Status</th><th>Criada em</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

function openNovaCampanhaModal() {
  openModal(`
    <div class="modal-header">
      <h3>Nova Campanha</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formCampanha">
        <div class="form-group">
          <label class="form-label">Nome da campanha</label>
          <input class="form-input" name="nome" placeholder="Ex: Promoção de Verão" required>
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-textarea" name="descricao" placeholder="Detalhes da campanha..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Dias da semana</label>
          <div class="week-selector">
            ${['D','S','T','Q','Q','S','S'].map((d,i) => `<div class="day-chip active" data-day="${i}">${d}</div>`).join('')}
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitCampanha()">Criar Campanha</button>
    </div>
  `);
  $all('.day-chip').forEach(d => d.addEventListener('click', () => d.classList.toggle('active')));
}

async function submitCampanha() {
  const form = $('#formCampanha');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/campanhas', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Campanha criada!'); closeModal(); renderCampanhas(); }
}

async function deleteCampanha(id) {
  if (!confirm('Deseja realmente excluir esta campanha?')) return;
  const result = await api(`/campanhas/${id}`, { method: 'DELETE' });
  if (result) { toast('Campanha removida'); renderCampanhas(); }
}

/* ---------------- Mídias ---------------- */
const CATEGORIAS_MIDIA = ['Promoção', 'Institucional', 'Produto', 'Evento', 'Aviso', 'Outro'];

async function renderMidias() {
  state.midias = await api('/midias') || [];
  state.grupos = await api('/grupos') || [];
  state.clientes = await api('/clientes') || [];
  state.telas = await api('/telas') || [];
  $('#topbarActions').innerHTML = `
    <button class="btn btn-secondary" onclick="navigate('grupos')">🗂️ Grupos</button>
    <button class="btn btn-primary" onclick="openNovaMidiaModal()">+ Nova mídia</button>
  `;

  const rows = state.midias.map(m => `
    <tr>
      <td><strong>${m.nome}</strong><div class="text-muted" style="font-size:11px;">${tipoLabel(m.tipo)}${m.categoria ? ' · ' + m.categoria : ''}</div></td>
      <td>${midiaQtdTelas(m.id)}</td>
      <td>${m.url_horizontal ? '🖥️' : ''}${m.url_vertical ? '📱' : ''}${!m.url_horizontal && !m.url_vertical ? (m.orientacao || 'Paisagem') : ''}</td>
      <td><span class="status-pill ${m.status === 'ativo' ? 'online' : 'offline'}">${m.status || 'ativo'}</span></td>
      <td>${timeAgo(m.criado_em)}</td>
      <td>
        <div class="action-icons">
          <button title="Editar" onclick="editMidia(${m.id})">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteMidia(${m.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar" style="justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm">🔽 Filtros</button>
      </div>
      ${state.midias.length === 0 ? `
        <div class="empty-state">
          <div class="icon">🖼️</div>
          <h4>Nenhum registro encontrado</h4>
          <p>A consulta solicitada não retornou nenhum registro para ser exibido.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Mídia</th><th>Qtd. telas</th><th>Orientação</th><th>Status</th><th>Última alteração</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

function tipoLabel(tipo) {
  return { video: 'Vídeo/imagem', imagem: 'Vídeo/imagem', youtube: 'Vídeo YouTube', link: 'Link externo', programatica: 'Mídia programática' }[tipo] || 'arquivo';
}

function midiaQtdTelas(midiaId) {
  const n = state.grupos.reduce((acc, g) => {
    const ids = JSON.parse(g.midias_ids || '[]');
    return acc + (ids.includes(midiaId) ? JSON.parse(g.telas_ids || '[]').length : 0);
  }, 0);
  return n || '—';
}

function midiaFormPadrao() {
  return {
    id: null, tipo: 'imagem', nome: '', cliente_id: '', categoria: '',
    url: '', url_horizontal: '', url_vertical: '',
    duracao_segundos: 10, gravar_estatisticas: true, status: 'ativo',
    agenda_inicio: '', agenda_fim: '', agenda_hora_inicio: '', agenda_hora_fim: '',
    agenda_dias_semana: [0,1,2,3,4,5,6],
    telas_rapidas: [],
  };
}

function openNovaMidiaModal() {
  openModal(`
    <div class="modal-header">
      <h3>Nova mídia</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="grid grid-4" style="gap:12px;">
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="escolherTipoMidia('imagem')">
          <div style="font-size:26px;">🎞️</div>Vídeo/imagem
        </div>
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="escolherTipoMidia('youtube')">
          <div style="font-size:26px;">▶️</div>Vídeo YouTube
        </div>
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="escolherTipoMidia('link')">
          <div style="font-size:26px;">🔗</div>Link externo
        </div>
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="escolherTipoMidia('programatica')">
          <div style="font-size:26px;">📡</div>Mídia programática
        </div>
      </div>
    </div>
  `);
}

function escolherTipoMidia(tipo) {
  state.midiaForm = midiaFormPadrao();
  state.midiaForm.tipo = tipo;
  abrirMidiaFormModal('info');
}

function editMidia(id) {
  const m = state.midias.find(x => x.id === id);
  if (!m) return;
  const grupoRapido = state.grupos.find(g => g.midia_auto_id === id);
  state.midiaForm = {
    id: m.id, tipo: m.tipo || 'imagem', nome: m.nome || '',
    cliente_id: m.cliente_id || '', categoria: m.categoria || '',
    url: m.url || '', url_horizontal: m.url_horizontal || '', url_vertical: m.url_vertical || '',
    duracao_segundos: m.duracao_segundos || 10,
    gravar_estatisticas: m.gravar_estatisticas !== 0,
    status: m.status || 'ativo',
    agenda_inicio: m.agenda_inicio || '', agenda_fim: m.agenda_fim || '',
    agenda_hora_inicio: m.agenda_hora_inicio || '', agenda_hora_fim: m.agenda_hora_fim || '',
    agenda_dias_semana: (m.agenda_dias_semana || '0,1,2,3,4,5,6').split(',').filter(Boolean).map(Number),
    telas_rapidas: grupoRapido ? JSON.parse(grupoRapido.telas_ids || '[]') : [],
  };
  abrirMidiaFormModal('info');
}

const MIDIA_TITULOS = {
  imagem: 'Vídeo/imagem', youtube: 'Vídeo YouTube', link: 'Link externo', programatica: 'Mídia programática',
};

function capturarAbaMidia(aba) {
  const f = state.midiaForm;
  if (aba === 'info') {
    f.nome = document.getElementById('midiaNome')?.value ?? f.nome;
    f.cliente_id = document.getElementById('midiaCliente')?.value ?? f.cliente_id;
    f.categoria = document.getElementById('midiaCategoria')?.value ?? f.categoria;
    f.url = document.getElementById('midiaUrl')?.value ?? f.url;
    f.duracao_segundos = document.getElementById('midiaDuracao')?.value ?? f.duracao_segundos;
  } else if (aba === 'agendamento') {
    f.agenda_inicio = document.getElementById('midiaAgendaInicio')?.value ?? f.agenda_inicio;
    f.agenda_fim = document.getElementById('midiaAgendaFim')?.value ?? f.agenda_fim;
    f.agenda_hora_inicio = document.getElementById('midiaAgendaHoraInicio')?.value ?? f.agenda_hora_inicio;
    f.agenda_hora_fim = document.getElementById('midiaAgendaHoraFim')?.value ?? f.agenda_hora_fim;
  }
}

function mudarAbaMidia(abaAtual, novaAba) {
  capturarAbaMidia(abaAtual);
  abrirMidiaFormModal(novaAba);
}

function abrirMidiaFormModal(aba) {
  const f = state.midiaForm;
  const abas = [['info', 'ⓘ Info'], ['agendamento', '📅 Agendamento'], ['rapida', '🚀 Inclusão rápida']];

  openModal(`
    <div class="modal-header">
      <h3>${f.id ? 'Editar' : 'Nova'} mídia — ${MIDIA_TITULOS[f.tipo]}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-tabs">
      ${abas.map(([key, label]) => `<div class="modal-tab ${aba === key ? 'active' : ''}" onclick="mudarAbaMidia('${aba}', '${key}')">${label}</div>`).join('')}
    </div>
    <div class="modal-body" id="midiaFormBody">${renderMidiaAba(aba)}</div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarMidiaForm('${aba}')">💾 Salvar</button>
    </div>
  `);
}

function renderMidiaAba(aba) {
  const f = state.midiaForm;
  const isUpload = f.tipo === 'imagem';

  if (aba === 'info') {
    return `
      <div class="form-group">
        <label class="form-label">Nome</label>
        <input class="form-input" id="midiaNome" value="${f.nome}" placeholder="Ex: Promoção de verão" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cliente</label>
          <select class="form-select" id="midiaCliente">
            <option value="">Nenhum</option>
            ${state.clientes.map(c => `<option value="${c.id}" ${String(f.cliente_id) === String(c.id) ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select class="form-select" id="midiaCategoria">
            <option value="">Selecione</option>
            ${CATEGORIAS_MIDIA.map(c => `<option value="${c}" ${f.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      ${isUpload ? `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Arquivo horizontal</label>
            ${f.url_horizontal ? `<p class="text-muted" style="font-size:12px;">✅ Enviado</p>` : ''}
            <label class="upload-box" style="cursor:pointer;display:block;">
              📤 Clique para escolher ou arraste um arquivo aqui
              <div class="form-hint">Aceita: image/*, video/*</div>
              <input type="file" accept="image/*,video/*" style="display:none;" onchange="onUploadMidiaArquivo(this, 'url_horizontal')">
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Arquivo vertical</label>
            ${f.url_vertical ? `<p class="text-muted" style="font-size:12px;">✅ Enviado</p>` : ''}
            <label class="upload-box" style="cursor:pointer;display:block;">
              📤 Clique para escolher ou arraste um arquivo aqui
              <div class="form-hint">Aceita: image/*, video/*</div>
              <input type="file" accept="image/*,video/*" style="display:none;" onchange="onUploadMidiaArquivo(this, 'url_vertical')">
            </label>
          </div>
        </div>
        <p class="form-hint">Envie o mesmo conteúdo nas duas orientações se você tiver telas horizontais e verticais. Pode enviar só uma se só usar um tipo de tela.</p>
      ` : `
        <div class="form-group">
          <label class="form-label">${f.tipo === 'youtube' ? 'URL do vídeo' : f.tipo === 'link' ? 'URL' : 'Tag / URL do parceiro'}</label>
          <input class="form-input" id="midiaUrl" value="${f.url}" placeholder="https://...">
        </div>
      `}
      <div class="form-group">
        <label class="form-label">Duração${isUpload ? ' (imagens)' : ''}</label>
        <input class="form-input" type="number" min="1" id="midiaDuracao" value="${f.duracao_segundos}">
        <p class="form-hint">em segundos</p>
      </div>
      <div class="switch-row">
        <div>
          <div class="switch-label">Gravar estatísticas</div>
          <div class="switch-hint">Caso marcado, irá contabilizar estatística de reprodução</div>
        </div>
        <label class="switch"><input type="checkbox" ${f.gravar_estatisticas ? 'checked' : ''} onchange="state.midiaForm.gravar_estatisticas = this.checked"><span class="slider"></span></label>
      </div>
    `;
  }

  if (aba === 'agendamento') {
    return `
      <p class="form-hint" style="margin-top:0;">Programe a reprodução dessa mídia em horários ou dias específicos, de acordo com sua estratégia. Deixe em branco caso não queira aplicar nenhuma regra.</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Iniciar em</label>
          <input class="form-input" type="date" id="midiaAgendaInicio" value="${f.agenda_inicio}">
        </div>
        <div class="form-group">
          <label class="form-label">Parar em</label>
          <input class="form-input" type="date" id="midiaAgendaFim" value="${f.agenda_fim}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Faixa de horário</label>
        <div class="form-row">
          <input class="form-input" type="time" id="midiaAgendaHoraInicio" value="${f.agenda_hora_inicio}">
          <input class="form-input" type="time" id="midiaAgendaHoraFim" value="${f.agenda_hora_fim}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Programação semanal</label>
        <div class="week-selector">
          ${DIAS_SEMANA_LABELS.map((d, i) => `<div class="day-chip selectable ${f.agenda_dias_semana.includes(i) ? 'active' : ''}" onclick="toggleDiaSemanaMidia(${i})">${d}</div>`).join('')}
        </div>
        <p class="form-hint">Caso não informado, será exibida em todos os dias da semana</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="limparAgendaMidia()">🧹 Limpar valores</button>
    `;
  }

  // rapida
  const q = (state.buscaTelaRapida || '').toLowerCase();
  const telasFiltradas = state.telas.filter(t => t.nome.toLowerCase().includes(q));
  return `
    <div style="font-weight:600;margin-bottom:6px;">🚀 Inclusão rápida</div>
    <p class="text-muted" style="font-size:12px;">Quer economizar tempo? Use esta opção pra incluir essa mídia em várias telas de uma vez só, sem precisar ir em "Vincular telas" depois. A mídia sempre irá para o final da playlist.</p>
    <div class="form-group">
      <label class="form-label">Telas disponíveis</label>
      <input class="form-input" placeholder="Busque pelo nome da tela..." oninput="state.buscaTelaRapida=this.value; $('#listaTelasRapida').innerHTML = renderListaTelasRapida();">
    </div>
    <div id="listaTelasRapida" style="max-height:200px;overflow-y:auto;">${renderListaTelasRapida()}</div>
    <p class="form-hint">O conteúdo só será adicionado à tela de mesma orientação</p>
  `;
}

function renderListaTelasRapida() {
  const q = (state.buscaTelaRapida || '').toLowerCase();
  const f = state.midiaForm;
  return (state.telas || []).filter(t => t.nome.toLowerCase().includes(q)).map(t => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;">
      <input type="checkbox" ${f.telas_rapidas.includes(t.id) ? 'checked' : ''} onchange="toggleTelaRapidaMidia(${t.id})">
      ${t.nome} <span class="text-muted" style="font-size:11px;">(${t.orientacao || 'Horizontal'})</span>
    </label>
  `).join('') || '<p class="text-muted" style="font-size:12px;">Nenhuma tela cadastrada ainda.</p>';
}

function toggleTelaRapidaMidia(id) {
  const f = state.midiaForm;
  f.telas_rapidas = f.telas_rapidas.includes(id) ? f.telas_rapidas.filter(x => x !== id) : [...f.telas_rapidas, id];
  $('#listaTelasRapida').innerHTML = renderListaTelasRapida();
}

function toggleDiaSemanaMidia(dia) {
  capturarAbaMidia('agendamento');
  const f = state.midiaForm;
  f.agenda_dias_semana = f.agenda_dias_semana.includes(dia) ? f.agenda_dias_semana.filter(d => d !== dia) : [...f.agenda_dias_semana, dia];
  $('#midiaFormBody').innerHTML = renderMidiaAba('agendamento');
}

function limparAgendaMidia() {
  const f = state.midiaForm;
  f.agenda_inicio = ''; f.agenda_fim = ''; f.agenda_hora_inicio = ''; f.agenda_hora_fim = '';
  f.agenda_dias_semana = [0,1,2,3,4,5,6];
  $('#midiaFormBody').innerHTML = renderMidiaAba('agendamento');
}

async function onUploadMidiaArquivo(inputEl, campo) {
  const file = inputEl.files[0];
  if (!file) return;
  capturarAbaMidia('info');
  const fd = new FormData();
  fd.append('arquivo', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) throw new Error('Falha no upload');
    const uploaded = await res.json();
    state.midiaForm[campo] = uploaded.url;
    $('#midiaFormBody').innerHTML = renderMidiaAba('info');
    toast('Arquivo enviado!');
  } catch (err) {
    toast('Erro ao enviar o arquivo', 'error');
  }
}

async function salvarMidiaForm(abaAtual) {
  capturarAbaMidia(abaAtual);
  const f = state.midiaForm;
  if (!f.nome || !f.nome.trim()) { toast('Informe o nome da mídia', 'error'); return; }
  if (f.tipo === 'imagem' && !f.url_horizontal && !f.url_vertical) {
    toast('Envie ao menos um arquivo (horizontal ou vertical)', 'error');
    return;
  }
  if (f.tipo !== 'imagem' && !f.url) {
    toast('Informe a URL da mídia', 'error');
    return;
  }

  const payload = { ...f, cliente_id: f.cliente_id || null };

  const result = f.id
    ? await api(`/midias/${f.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await api('/midias', { method: 'POST', body: JSON.stringify(payload) });

  if (result) {
    toast(f.id ? 'Mídia atualizada!' : 'Mídia cadastrada!');
    closeModal();
    renderMidias();
  }
}

async function deleteMidia(id) {
  if (!confirm('Deseja realmente excluir esta mídia?')) return;
  const result = await api(`/midias/${id}`, { method: 'DELETE' });
  if (result) { toast('Mídia removida'); renderMidias(); }
}

/* ---------------- Grupos de mídia ---------------- */
async function renderGrupos() {
  state.grupos = await api('/grupos') || [];
  state.midias = await api('/midias') || [];
  state.telas = await api('/telas') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovoGrupoModal()">+ Vincular mídias a telas</button>`;

  const rows = state.grupos.map(g => {
    const qtdMidias = JSON.parse(g.midias_ids || '[]').length;
    const telasIds = JSON.parse(g.telas_ids || '[]');
    const nomesTelas = telasIds.map(id => state.telas.find(t => t.id === id)?.nome).filter(Boolean).join(', ') || '—';
    return `
    <tr>
      <td><strong>${g.nome}</strong></td>
      <td>${qtdMidias} mídia(s)</td>
      <td>${nomesTelas}</td>
      <td><span class="status-pill ${g.status === 'ativo' ? 'online' : 'offline'}">${g.status || 'ativo'}</span></td>
      <td>${timeAgo(g.criado_em)}</td>
      <td>
        <div class="action-icons">
          <button title="Editar" onclick="editGrupo(${g.id})">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteGrupo(${g.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  $('#content').innerHTML = `
    <div class="table-wrap">
      <p class="text-muted" style="font-size:13px;margin:0 0 12px;">Aqui você escolhe quais mídias aparecem em quais telas. Crie um vínculo, marque as mídias e as telas desejadas.</p>
      ${state.grupos.length === 0 ? `
        <div class="empty-state">
          <div class="icon">🗂️</div>
          <h4>Nenhum vínculo criado ainda</h4>
          <p>Suas telas não vão exibir nenhuma mídia até você criar um vínculo aqui.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Nome</th><th>Mídias</th><th>Telas</th><th>Status</th><th>Última alteração</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

function grupoFormPadrao() {
  return { id: null, nome: '', imagem: null, midias_ids: [], telas_ids: [] };
}

function openNovoGrupoModal(grupoId = null) {
  const grupo = grupoId ? state.grupos.find(g => g.id === grupoId) : null;
  state.grupoForm = grupo
    ? { id: grupo.id, nome: grupo.nome, imagem: grupo.imagem || null,
        midias_ids: JSON.parse(grupo.midias_ids || '[]'), telas_ids: JSON.parse(grupo.telas_ids || '[]') }
    : grupoFormPadrao();
  state.buscaMidiaGrupo = '';
  state.buscaTelaGrupo = '';
  renderGrupoFormModal();
}

function renderGrupoFormModal() {
  const f = state.grupoForm;
  openModal(`
    <div class="modal-header">
      <h3>${f.id ? 'Editar vínculo' : 'Vincular mídias a telas'}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Imagem</label>
        ${f.imagem ? `<img src="${f.imagem}" style="max-height:70px;border-radius:8px;display:block;margin-bottom:8px;">` : ''}
        <label class="upload-box" style="cursor:pointer;display:block;">
          📤 ${f.imagem ? 'Trocar arquivo...' : 'Escolher arquivo...'}
          <input type="file" accept="image/*" style="display:none;" onchange="onUploadGrupoImagem(this)">
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Nome do vínculo</label>
        <input class="form-input" id="grupoNome" placeholder="Ex: Promoção de verão" value="${f.nome}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Mídias</label>
        <input class="form-input" placeholder="Busque pelo nome da mídia..." style="margin-bottom:8px;"
          oninput="state.buscaMidiaGrupo=this.value; $('#listaMidiasGrupo').innerHTML = renderListaMidiasGrupo();">
        <div id="listaMidiasGrupo" style="max-height:160px;overflow-y:auto;border:1px solid var(--border,#333);border-radius:8px;padding:8px;">
          ${renderListaMidiasGrupo()}
        </div>
        <p class="form-hint">O conteúdo só será reproduzido na tela de mesma orientação</p>
      </div>
      <div class="form-group">
        <label class="form-label">Telas</label>
        <input class="form-input" placeholder="Busque pelo nome da tela..." style="margin-bottom:8px;"
          oninput="state.buscaTelaGrupo=this.value; $('#listaTelasGrupo').innerHTML = renderListaTelasGrupo();">
        <div id="listaTelasGrupo" style="max-height:160px;overflow-y:auto;border:1px solid var(--border,#333);border-radius:8px;padding:8px;">
          ${renderListaTelasGrupo()}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarGrupoForm()">💾 Salvar</button>
    </div>
  `);
}

function renderListaMidiasGrupo() {
  const q = (state.buscaMidiaGrupo || '').toLowerCase();
  const f = state.grupoForm;
  const lista = state.midias.filter(m => m.nome.toLowerCase().includes(q));
  if (!lista.length) return '<p class="text-muted" style="font-size:12px;">Nenhuma mídia encontrada.</p>';
  return lista.map(m => `
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
      <input type="checkbox" ${f.midias_ids.includes(m.id) ? 'checked' : ''} onchange="toggleMidiaGrupo(${m.id})">
      ${m.nome} <span class="text-muted" style="font-size:11px;">(${tipoLabel(m.tipo)})</span>
    </label>
  `).join('');
}

function renderListaTelasGrupo() {
  const q = (state.buscaTelaGrupo || '').toLowerCase();
  const f = state.grupoForm;
  const lista = state.telas.filter(t => t.nome.toLowerCase().includes(q));
  if (!lista.length) return '<p class="text-muted" style="font-size:12px;">Nenhuma tela encontrada.</p>';
  return lista.map(t => `
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
      <input type="checkbox" ${f.telas_ids.includes(t.id) ? 'checked' : ''} onchange="toggleTelaGrupo(${t.id})">
      ${t.nome} <span class="text-muted" style="font-size:11px;">(ID: ${t.id})</span>
    </label>
  `).join('');
}

function toggleMidiaGrupo(id) {
  const f = state.grupoForm;
  f.midias_ids = f.midias_ids.includes(id) ? f.midias_ids.filter(x => x !== id) : [...f.midias_ids, id];
  $('#listaMidiasGrupo').innerHTML = renderListaMidiasGrupo();
}

function toggleTelaGrupo(id) {
  const f = state.grupoForm;
  f.telas_ids = f.telas_ids.includes(id) ? f.telas_ids.filter(x => x !== id) : [...f.telas_ids, id];
  $('#listaTelasGrupo').innerHTML = renderListaTelasGrupo();
}

async function onUploadGrupoImagem(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  state.grupoForm.nome = document.getElementById('grupoNome')?.value ?? state.grupoForm.nome;
  const fd = new FormData();
  fd.append('arquivo', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) throw new Error('Falha no upload');
    const uploaded = await res.json();
    state.grupoForm.imagem = uploaded.url;
    renderGrupoFormModal();
    toast('Imagem enviada!');
  } catch (err) {
    toast('Erro ao enviar imagem', 'error');
  }
}

function editGrupo(id) {
  openNovoGrupoModal(id);
}

async function salvarGrupoForm() {
  const f = state.grupoForm;
  f.nome = document.getElementById('grupoNome')?.value.trim() ?? f.nome;
  if (!f.nome) { toast('Informe o nome do vínculo', 'error'); return; }

  const payload = { nome: f.nome, imagem: f.imagem, midias_ids: f.midias_ids, telas_ids: f.telas_ids };
  const result = f.id
    ? await api(`/grupos/${f.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await api('/grupos', { method: 'POST', body: JSON.stringify(payload) });

  if (result) { toast(f.id ? 'Vínculo atualizado!' : 'Vínculo criado!'); closeModal(); renderGrupos(); }
}

async function deleteGrupo(id) {
  if (!confirm('Deseja realmente excluir este grupo?')) return;
  const result = await api(`/grupos/${id}`, { method: 'DELETE' });
  if (result) { toast('Grupo removido'); renderGrupos(); }
}

/* ---------------- Conteúdos dinâmicos ---------------- */
function renderConteudosDinamicos() {
  $('#topbarActions').innerHTML = '';
  const tabs = [
    { id: 'yeloo', label: 'Yeloo' },
    { id: 'saude', label: 'Saúde' },
    { id: 'datas-sazonais', label: 'Datas sazonais' },
    { id: 'loterias', label: 'Loterias' },
    { id: 'diversos', label: 'Diversos' },
  ];
  const ativo = state.conteudosDinamicosTab;
  const itens = CONTEUDOS_DINAMICOS[ativo] || [];

  $('#content').innerHTML = `
    <div class="modal-tabs" style="margin-bottom:16px;">
      ${tabs.map(t => `<div class="modal-tab ${t.id === ativo ? 'active' : ''}" onclick="setConteudosDinamicosTab('${t.id}')">${t.label}</div>`).join('')}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">📚 Conteúdos Dinâmicos ${tabs.find(t => t.id === ativo)?.label || ''}</span></div>
      <div class="grid grid-3" style="gap:16px;">
        ${itens.map(item => `
          <div class="card" style="padding:0;overflow:hidden;">
            <div style="height:110px;background:linear-gradient(135deg,var(--primary),#4c1d95);display:flex;align-items:center;justify-content:center;font-size:30px;">🎬</div>
            <div style="padding:12px;">
              <div class="text-muted" style="font-size:11px;">Grupo</div>
              <strong>${item.grupo}</strong>
              <div class="action-icons" style="margin-top:8px;">
                <button title="Adicionar a uma tela" onclick="toast('Selecione a tela para adicionar este conteúdo')">📋</button>
                <button title="Remover" class="danger" onclick="toast('Removido da sua lista')">🗙</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setConteudosDinamicosTab(tab) {
  state.conteudosDinamicosTab = tab;
  renderConteudosDinamicos();
}

/* ---------------- Instagram ---------------- */
async function renderInstagram() {
  state.instagramPerfis = await api('/instagram') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovoInstagramModal()">+ Novo perfil</button>`;

  $('#content').innerHTML = `
    <div class="alert-banner" style="background:rgba(217,164,6,.12);border:1px solid #d4a017;color:#e0b23a;padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
      <div>⚠️ Atenção! Os feeds são atualizados diariamente às: 08:15h, 13:15h e 18:15h</div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
      <div class="card" style="padding:10px 16px;display:inline-flex;gap:10px;align-items:center;">
        <span class="text-muted" style="font-size:12px;">Perfis de Instagram em uso</span>
        <span class="status-pill online">${state.instagramPerfis.length} perfil</span>
        <span class="text-muted" style="font-size:12px;">/ 5</span>
      </div>
    </div>
    ${state.instagramPerfis.length === 0 ? `
      <div class="table-wrap"><div class="empty-state">
        <div class="icon">📷</div>
        <h4>Nenhum perfil conectado</h4>
        <p>Conecte um perfil do Instagram para exibir os posts mais recentes nas suas telas.</p>
      </div></div>
    ` : `
      <div class="grid grid-3" style="gap:16px;">
        ${state.instagramPerfis.map(p => `
          <div class="card">
            <strong>@${p.usuario}</strong>
            <div class="action-icons" style="margin-top:8px;">
              <button title="Excluir" class="danger" onclick="deleteInstagram(${p.id})">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function openNovoInstagramModal() {
  openModal(`
    <div class="modal-header">
      <h3>Novo perfil do Instagram</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formInstagram">
        <div class="form-group">
          <label class="form-label">Usuário do Instagram</label>
          <input class="form-input" name="usuario" placeholder="Ex: minhaempresa" required>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitInstagram()">Salvar</button>
    </div>
  `);
}

async function submitInstagram() {
  const form = $('#formInstagram');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/instagram', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Perfil adicionado!'); closeModal(); renderInstagram(); }
}

async function deleteInstagram(id) {
  if (!confirm('Deseja realmente remover este perfil?')) return;
  const result = await api(`/instagram/${id}`, { method: 'DELETE' });
  if (result) { toast('Perfil removido'); renderInstagram(); }
}

/* ---------------- RSS Personalizado ---------------- */
async function renderRSS() {
  state.rssFeeds = await api('/rss') || [];
  state.telas = state.telas.length ? state.telas : (await api('/telas') || []);
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovoRSSModal()">+ Novo feed RSS</button>`;

  const rows = state.rssFeeds.map(f => `
    <tr>
      <td><strong>${f.titulo}</strong></td>
      <td>${f.fonte || '—'}</td>
      <td><span class="status-pill ${f.status === 'ativo' ? 'online' : 'offline'}">${f.status || 'ativo'}</span></td>
      <td>${timeAgo(f.criado_em)}</td>
      <td>
        <div class="action-icons">
          <button title="Excluir" class="danger" onclick="deleteRSS(${f.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar" style="justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm">🔽 Filtros</button>
      </div>
      ${state.rssFeeds.length === 0 ? `
        <div class="empty-state">
          <div class="icon">📡</div>
          <h4>Nenhum registro encontrado</h4>
          <p>A consulta solicitada não retornou nenhum registro para ser exibido.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Feed</th><th>Fonte</th><th>Status</th><th>Última alteração</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

function openNovoRSSModal(tab = 'info') {
  openModal(`
    <div class="modal-header">
      <h3>Novo feed RSS</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-tabs">
      <div class="modal-tab ${tab === 'info' ? 'active' : ''}" onclick="openNovoRSSModal('info')">ⓘ Info</div>
      <div class="modal-tab ${tab === 'rapida' ? 'active' : ''}" onclick="openNovoRSSModal('rapida')">🔒 Inclusão rápida</div>
    </div>
    <div class="modal-body">
      ${tab === 'info' ? `
        <form id="formRSS">
          <div class="form-group">
            <label class="form-label">Imagem</label>
            <div class="upload-box">📤 Escolher arquivo...</div>
          </div>
          <div class="form-group">
            <label class="form-label">Título</label>
            <input class="form-input" name="titulo" maxlength="75" placeholder="Ex: Notícias de esporte" required>
          </div>
          <div class="form-group">
            <label class="form-label">Fonte</label>
            <input class="form-input" name="fonte" placeholder="Ex: G1, R7, UOL">
          </div>
          <div class="form-group">
            <label class="form-label">Link</label>
            <input class="form-input" name="link" placeholder="https://...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cor de fundo</label>
              <input class="form-input" type="color" name="cor_fundo" value="#000000">
            </div>
            <div class="form-group">
              <label class="form-label">Cor da fonte</label>
              <input class="form-input" type="color" name="cor_fonte" value="#ffffff">
            </div>
          </div>
        </form>
      ` : `
        <div class="form-group">
          <div style="font-weight:600;margin-bottom:6px;">🔒 Inclusão rápida</div>
          <p class="text-muted" style="font-size:12px;">Quer economizar tempo? Use esta opção pra incluir essa mídia em várias telas de uma vez só, sem precisar incluir uma por uma depois. A mídia sempre irá para o final da playlist.</p>
          <label class="form-label">Telas disponíveis</label>
          <input class="form-input" placeholder="Busque pelo nome da tela..." list="listaTelasRSS">
          <datalist id="listaTelasRSS">${state.telas.map(t => `<option value="${t.nome}">`).join('')}</datalist>
          <p class="form-hint">O conteúdo só será adicionado à tela de mesma orientação</p>
        </div>
      `}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitRSS()">💾 Salvar</button>
    </div>
  `);
}

async function submitRSS() {
  const form = $('#formRSS');
  if (!form) { toast('Preencha as informações na aba Info', 'error'); return; }
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/rss', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Feed RSS criado!'); closeModal(); renderRSS(); }
}

async function deleteRSS(id) {
  if (!confirm('Deseja realmente excluir este feed?')) return;
  const result = await api(`/rss/${id}`, { method: 'DELETE' });
  if (result) { toast('Feed removido'); renderRSS(); }
}

/* ---------------- Clientes ---------------- */
async function renderClientes() {
  state.clientes = await api('/clientes') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovoClienteModal()">+ Novo cliente</button>`;

  const rows = state.clientes.map(c => `
    <tr>
      <td><strong>${c.nome}</strong>${c.email ? `<div class="text-muted" style="font-size:11px;">${c.email}</div>` : ''}</td>
      <td>${c.cidade || '—'}</td>
      <td>${c.telefone || '—'}</td>
      <td>
        <div class="action-icons">
          <button title="Editar" onclick="editCliente(${c.id})">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteCliente(${c.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar" style="justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm">🔽 Filtros</button>
      </div>
      ${state.clientes.length === 0 ? `
        <div class="empty-state">
          <div class="icon">👥</div>
          <h4>Nenhum registro encontrado</h4>
          <p>A consulta solicitada não retornou nenhum registro para ser exibido.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Cliente</th><th>Cidade</th><th>Telefone</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

function openNovoClienteModal() {
  openModal(`
    <div class="modal-header">
      <h3>Novo cliente</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formCliente">
        <div class="form-group">
          <label class="form-label">Nome do cliente</label>
          <input class="form-input" name="nome" placeholder="Ex: Padaria Pão Quente" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cidade</label>
            <input class="form-input" name="cidade" placeholder="Ex: Viçosa do Ceará - CE">
          </div>
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input class="form-input" name="telefone" placeholder="(88) 90000-0000">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input class="form-input" name="email" type="email" placeholder="contato@cliente.com">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitCliente()">Salvar cliente</button>
    </div>
  `);
}

async function submitCliente() {
  const form = $('#formCliente');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/clientes', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Cliente cadastrado!'); closeModal(); renderClientes(); }
}

function editCliente(id) {
  const c = state.clientes.find(x => x.id === id);
  if (!c) return;
  openModal(`
    <div class="modal-header">
      <h3>Editar cliente</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formCliente">
        <div class="form-group">
          <label class="form-label">Nome do cliente</label>
          <input class="form-input" name="nome" value="${c.nome}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cidade</label>
            <input class="form-input" name="cidade" value="${c.cidade || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input class="form-input" name="telefone" value="${c.telefone || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input class="form-input" name="email" type="email" value="${c.email || ''}">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEditCliente(${id})">Salvar</button>
    </div>
  `);
}

async function submitEditCliente(id) {
  const form = $('#formCliente');
  const data = Object.fromEntries(new FormData(form));
  const result = await api(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result) { toast('Cliente atualizado!'); closeModal(); renderClientes(); }
}

async function deleteCliente(id) {
  if (!confirm('Deseja realmente excluir este cliente?')) return;
  const result = await api(`/clientes/${id}`, { method: 'DELETE' });
  if (result) { toast('Cliente removido'); renderClientes(); }
}

/* ---------------- Helper: página em construção ---------------- */
function renderEmConstrucao(icon, titulo, descricao) {
  $('#content').innerHTML = `
    <div class="table-wrap">
      <div class="empty-state">
        <div class="icon">${icon}</div>
        <h4>${titulo} em construção</h4>
        <p>${descricao}</p>
      </div>
    </div>
  `;
}

/* ---------------- Relatórios ---------------- */
async function renderRelatorios() {
  $('#topbarActions').innerHTML = '';
  const dias = state.relatoriosPeriodo || 7;

  const [overview, exibicoes, disponibilidade] = await Promise.all([
    api('/relatorios/overview'),
    api(`/relatorios/exibicoes?dias=${dias}`),
    api(`/relatorios/disponibilidade?dias=${dias}`),
  ]);

  const ov = overview || { telas_total: 0, telas_online: 0, telas_offline: 0, clientes_total: 0, campanhas_ativas: 0, midias_total: 0 };
  const exib = exibicoes || { telas: [] };
  const disp = disponibilidade || { telas: [], modo: 'instantaneo' };

  const cardsOverview = [
    ['📺', 'Telas cadastradas', ov.telas_total, 'var(--text)'],
    ['🟢', 'Telas online agora', ov.telas_online, 'var(--success)'],
    ['⚪', 'Telas offline', ov.telas_offline, 'var(--text-muted)'],
    ['👥', 'Clientes', ov.clientes_total, 'var(--text)'],
    ['📢', 'Campanhas ativas', ov.campanhas_ativas, 'var(--text)'],
    ['🎞️', 'Mídias cadastradas', ov.midias_total, 'var(--text)'],
  ];

  $('#content').innerHTML = `
    <div class="grid grid-3" style="margin-bottom:20px;">
      ${cardsOverview.map(([icon, label, valor, cor]) => `
        <div class="card">
          <div class="card-title" style="color:var(--text-muted);font-weight:600;">${icon} ${label}</div>
          <div class="stat-value" style="color:${cor};">${valor}</div>
        </div>
      `).join('')}
    </div>

    <div class="filter-chips" style="margin-bottom:14px;">
      <div class="chip ${dias === 7 ? 'active' : ''}" onclick="setRelatoriosPeriodo(7)">Últimos 7 dias</div>
      <div class="chip ${dias === 30 ? 'active' : ''}" onclick="setRelatoriosPeriodo(30)">Últimos 30 dias</div>
    </div>

    <div class="card" style="margin-bottom:20px;padding:0;">
      <div class="card-header" style="padding:20px 20px 0;"><span class="card-title">Exibições por tela</span></div>
      <div style="padding:0 4px 4px;">
        ${exib.telas.length === 0 ? '<p class="text-muted" style="font-size:12px;padding:0 16px 16px;">Nenhuma tela cadastrada ainda.</p>' : `
          <table>
            <thead><tr><th>Tela</th><th>Exibições no período</th><th>Última exibição</th></tr></thead>
            <tbody>
              ${exib.telas.map(t => `
                <tr><td>${t.tela_nome}</td><td>${t.total_exibicoes}</td><td>${t.ultima_exibicao ? timeAgo(t.ultima_exibicao) : '—'}</td></tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Taxa de disponibilidade por tela</span></div>
      ${disp.modo === 'instantaneo' ? `
        <p class="text-muted" style="font-size:12px;margin-bottom:14px;">
          Ainda não há histórico suficiente para calcular a disponibilidade ao longo do período — mostrando o status atual de cada tela.
          O histórico começa a ser gravado automaticamente a partir de agora (a cada 5 minutos), então em alguns dias essa métrica passa a refletir o período real.
        </p>
      ` : ''}
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${disp.telas.length === 0 ? '<p class="text-muted" style="font-size:12px;">Nenhuma tela cadastrada ainda.</p>' : disp.telas.map(t => {
          const pct = t.disponibilidade_pct;
          const cor = pct == null ? 'var(--text-muted)' : pct >= 90 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
          return `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>${t.tela_nome}</span><strong>${pct == null ? '—' : pct + '%'}</strong></div>
            <div style="background:var(--bg);border-radius:6px;height:10px;overflow:hidden;">
              <div style="height:100%;width:${pct || 0}%;background:${cor};"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function setRelatoriosPeriodo(dias) {
  state.relatoriosPeriodo = dias;
  renderRelatorios();
}

/* ============================================================
   WhatsApp CRM
   ============================================================ */
const WHATSAPP_TABS = [
  ['whatsapp-atendimento', '📥 Atendimento'],
  ['whatsapp-crm', '🧭 CRM'],
  ['whatsapp-etiquetas', '🏷️ Etiquetas'],
  ['whatsapp-templates', '📄 Modelos'],
  ['whatsapp-metricas', '📊 Métricas'],
  ['whatsapp-config', '⚙️ Configurações'],
];
function renderWhatsappTabs(ativo) {
  return `<div class="modal-tabs" style="margin-bottom:16px;">
    ${WHATSAPP_TABS.map(([key, label]) => `<div class="modal-tab ${key === ativo ? 'active' : ''}" onclick="navigate('${key}')">${label}</div>`).join('')}
  </div>`;
}

function whatsappConfigBanner() {
  return `
    <div class="alert-banner" style="background:rgba(217,164,6,.12);border:1px solid #d4a017;color:#e0b23a;padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div>⚠️ WhatsApp não configurado — vá em Configurações</div>
      <button class="btn btn-secondary btn-sm" onclick="navigate('whatsapp-config')">Configurar agora</button>
    </div>
  `;
}
function whatsappConfigured() {
  const c = state.whatsappConfig;
  return !!(c && c.phone_number_id && c.access_token);
}

/* ---------------- Atendimento (Inbox) ---------------- */
async function renderWhatsappAtendimento() {
  $('#topbarActions').innerHTML = '';
  state.whatsappConfig = await api('/whatsapp/config') || {};

  if (!whatsappConfigured()) {
    $('#content').innerHTML = renderWhatsappTabs('whatsapp-atendimento') + whatsappConfigBanner();
    return;
  }

  state.whatsappConversas = await api('/whatsapp/conversas') || [];
  const conversaAtual = state.whatsappConversaAtualId
    ? state.whatsappConversas.find(c => c.id === state.whatsappConversaAtualId)
    : null;

  $('#content').innerHTML = `
    ${renderWhatsappTabs('whatsapp-atendimento')}
    <div class="wa-inbox">
      <div class="wa-conversas-list">
        ${state.whatsappConversas.length === 0 ? `
          <div class="empty-state">
            <div class="icon">📥</div>
            <h4>Nenhuma conversa ainda</h4>
            <p>As conversas aparecem aqui assim que um contato enviar uma mensagem pelo WhatsApp.</p>
          </div>
        ` : state.whatsappConversas.map(c => `
          <div class="wa-conversa-item ${state.whatsappConversaAtualId === c.id ? 'active' : ''}" onclick="abrirConversaWhatsapp(${c.id})">
            <div class="wa-avatar">${(c.contato_nome || c.contato_telefone || '?').charAt(0).toUpperCase()}</div>
            <div class="wa-conversa-info">
              <div class="wa-conversa-nome">${c.contato_nome || c.contato_telefone} <span class="wa-etapa-tag">${c.etapa_funil || 'Novo'}</span></div>
              <div class="wa-conversa-preview">${(c.ultima_mensagem_texto || 'Sem mensagens ainda').toString().slice(0, 60)}</div>
            </div>
            ${c.nao_lida ? '<span class="wa-unread-dot" title="Não lida"></span>' : ''}
          </div>
        `).join('')}
      </div>
      <div class="wa-chat-panel">
        ${conversaAtual ? renderWhatsappChatThread(conversaAtual) : `
          <div class="empty-state">
            <div class="icon">💬</div>
            <h4>Selecione uma conversa</h4>
            <p>Escolha uma conversa na lista ao lado para ver e responder as mensagens.</p>
          </div>
        `}
      </div>
    </div>
  `;

  if (conversaAtual) carregarMensagensWhatsapp(conversaAtual.id);
}

function renderWhatsappChatThread(conversa) {
  return `
    <div class="wa-chat-header">
      <div class="wa-avatar">${(conversa.contato_nome || conversa.contato_telefone || '?').charAt(0).toUpperCase()}</div>
      <div>
        <strong>${conversa.contato_nome || conversa.contato_telefone}</strong>
        <div class="text-muted" style="font-size:12px;">${conversa.contato_telefone}</div>
      </div>
    </div>
    <div class="wa-messages" id="waMessages"><div class="loader"></div></div>
    <form class="wa-chat-input" onsubmit="event.preventDefault(); enviarMensagemChat(${conversa.id}); return false;">
      <input class="form-input" id="waMensagemInput" placeholder="Digite uma mensagem..." autocomplete="off">
      <button class="btn btn-primary" type="submit">Enviar</button>
    </form>
  `;
}

function abrirConversaWhatsapp(id) {
  state.whatsappConversaAtualId = id;
  renderWhatsappAtendimento();
}

async function carregarMensagensWhatsapp(conversaId) {
  const mensagens = await api(`/whatsapp/conversas/${conversaId}/mensagens`) || [];
  const wrap = $('#waMessages');
  if (!wrap) return;
  wrap.innerHTML = mensagens.length === 0
    ? '<p class="text-muted" style="font-size:12px;padding:12px;">Nenhuma mensagem ainda.</p>'
    : mensagens.map(m => `
      <div class="wa-bubble ${m.direcao === 'saida' ? 'out' : 'in'}">
        <div class="wa-bubble-text">${(m.texto || '').replace(/</g, '&lt;')}</div>
        <div class="wa-bubble-meta">${new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${m.direcao === 'saida' ? ' · ' + (m.status || '') : ''}</div>
      </div>
    `).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

async function enviarMensagemChat(conversaId) {
  const input = $('#waMensagemInput');
  const texto = input.value.trim();
  if (!texto) return;
  input.value = '';
  const result = await api(`/whatsapp/conversas/${conversaId}/mensagens`, { method: 'POST', body: JSON.stringify({ texto }) });
  if (result?.aviso) toast(result.aviso, 'error');
  const conversas = await api('/whatsapp/conversas') || [];
  state.whatsappConversas = conversas;
  carregarMensagensWhatsapp(conversaId);
}

/* ---------------- CRM: contatos, funil e kanban ---------------- */
let waCrmFiltroTimeout = null;
function debounceCrmFiltro() {
  clearTimeout(waCrmFiltroTimeout);
  waCrmFiltroTimeout = setTimeout(() => renderWhatsappCrm(), 350);
}
function setWhatsappCrmView(v) { state.whatsappCrmView = v; renderWhatsappCrm(); }

async function renderWhatsappCrm() {
  state.whatsappEtiquetas = await api('/whatsapp/etiquetas') || [];

  const params = new URLSearchParams();
  if (state.whatsappFiltroTag) params.set('tag', state.whatsappFiltroTag);
  if (state.whatsappFiltroEtapa) params.set('etapa', state.whatsappFiltroEtapa);
  if (state.whatsappBusca) params.set('busca', state.whatsappBusca);
  state.whatsappContatos = await api(`/whatsapp/contatos${params.toString() ? '?' + params.toString() : ''}`) || [];

  $('#topbarActions').innerHTML = `
    <button class="btn btn-secondary" onclick="setWhatsappCrmView('${state.whatsappCrmView === 'kanban' ? 'lista' : 'kanban'}')">${state.whatsappCrmView === 'kanban' ? '📋 Ver lista' : '🧭 Ver funil'}</button>
    <button class="btn btn-primary" onclick="openNovoContatoWhatsappModal()">+ Novo contato</button>
  `;

  $('#content').innerHTML = `
    ${renderWhatsappTabs('whatsapp-crm')}
    <div class="filter-chips" style="margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <input class="form-input" style="max-width:220px;" placeholder="Buscar por nome ou telefone..." value="${state.whatsappBusca || ''}"
        oninput="state.whatsappBusca=this.value; debounceCrmFiltro();">
      <select class="form-select" style="max-width:190px;" onchange="state.whatsappFiltroEtapa=this.value; renderWhatsappCrm();">
        <option value="">Todas as etapas</option>
        ${FUNIL_ETAPAS.map(e => `<option value="${e}" ${state.whatsappFiltroEtapa === e ? 'selected' : ''}>${e}</option>`).join('')}
      </select>
      <select class="form-select" style="max-width:190px;" onchange="state.whatsappFiltroTag=this.value; renderWhatsappCrm();">
        <option value="">Todas as etiquetas</option>
        ${state.whatsappEtiquetas.map(t => `<option value="${t.id}" ${String(state.whatsappFiltroTag) === String(t.id) ? 'selected' : ''}>${t.nome}</option>`).join('')}
      </select>
    </div>
    ${state.whatsappCrmView === 'kanban' ? renderWhatsappKanban() : renderWhatsappContatosLista()}
  `;
}

function renderWhatsappContatosLista() {
  if (state.whatsappContatos.length === 0) {
    return `<div class="table-wrap"><div class="empty-state"><div class="icon">🧭</div><h4>Nenhum contato encontrado</h4><p>Cadastre um contato ou ajuste os filtros de busca.</p></div></div>`;
  }
  const rows = state.whatsappContatos.map(c => `
    <tr>
      <td><strong style="cursor:pointer;" onclick="abrirDetalheContatoWhatsapp(${c.id})">${c.nome || '(Sem nome)'}</strong><div class="text-muted" style="font-size:11px;">${c.telefone}</div></td>
      <td>${(c.etiquetas || []).map(t => `<span class="wa-tag-pill" style="background:${t.cor}22;color:${t.cor};">${t.nome}</span>`).join(' ') || '—'}</td>
      <td><span class="status-pill active">${c.etapa_funil || 'Novo'}</span></td>
      <td>${fmtDate(c.atualizado_em)}</td>
      <td>
        <div class="action-icons">
          <button title="Ver detalhes" onclick="abrirDetalheContatoWhatsapp(${c.id})">👁️</button>
          <button title="Excluir" class="danger" onclick="deleteContatoWhatsapp(${c.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Contato</th><th>Etiquetas</th><th>Etapa</th><th>Último contato</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderWhatsappKanban() {
  return `
    <div class="wa-kanban">
      ${FUNIL_ETAPAS.map(etapa => {
        const contatos = state.whatsappContatos.filter(c => (c.etapa_funil || 'Novo') === etapa);
        const idx = FUNIL_ETAPAS.indexOf(etapa);
        return `
        <div class="wa-kanban-col">
          <div class="wa-kanban-col-header">${etapa} <span class="count">${contatos.length}</span></div>
          <div class="wa-kanban-col-body">
            ${contatos.map(c => `
              <div class="wa-kanban-card">
                <strong>${c.nome || c.telefone}</strong>
                <div class="text-muted" style="font-size:11px;">${c.telefone}</div>
                <div class="wa-kanban-actions">
                  <button title="Mover para etapa anterior" ${idx === 0 ? 'disabled' : ''} onclick="moverEtapaContato(${c.id}, -1)">◀</button>
                  <button title="Ver detalhes" onclick="abrirDetalheContatoWhatsapp(${c.id})">👁️</button>
                  <button title="Mover para próxima etapa" ${idx === FUNIL_ETAPAS.length - 1 ? 'disabled' : ''} onclick="moverEtapaContato(${c.id}, 1)">▶</button>
                </div>
              </div>
            `).join('') || '<p class="text-muted" style="font-size:11px;padding:6px 0;">Vazio</p>'}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function moverEtapaContato(id, delta) {
  const c = state.whatsappContatos.find(x => x.id === id);
  if (!c) return;
  const idx = FUNIL_ETAPAS.indexOf(c.etapa_funil || 'Novo');
  const novoIdx = idx + delta;
  if (novoIdx < 0 || novoIdx >= FUNIL_ETAPAS.length) return;
  await api(`/whatsapp/contatos/${id}/etapa`, { method: 'PUT', body: JSON.stringify({ etapa_funil: FUNIL_ETAPAS[novoIdx] }) });
  renderWhatsappCrm();
}

function openNovoContatoWhatsappModal() {
  openModal(`
    <div class="modal-header"><h3>Novo contato</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <form id="formContatoWhatsapp">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="nome" placeholder="Ex: João Silva"></div>
        <div class="form-group"><label class="form-label">Telefone (com DDI, só números)</label><input class="form-input" name="telefone" placeholder="Ex: 5588900000000" required></div>
        <div class="form-group">
          <label class="form-label">Etapa do funil</label>
          <select class="form-select" name="etapa_funil">
            ${FUNIL_ETAPAS.map(e => `<option value="${e}">${e}</option>`).join('')}
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitContatoWhatsapp()">Salvar</button>
    </div>
  `);
}
async function submitContatoWhatsapp() {
  const form = $('#formContatoWhatsapp');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/whatsapp/contatos', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Contato cadastrado!'); closeModal(); renderWhatsappCrm(); }
}
async function deleteContatoWhatsapp(id) {
  if (!confirm('Deseja realmente excluir este contato?')) return;
  const result = await api(`/whatsapp/contatos/${id}`, { method: 'DELETE' });
  if (result) { toast('Contato removido'); renderWhatsappCrm(); }
}

async function abrirDetalheContatoWhatsapp(id) {
  const lista = await api('/whatsapp/contatos') || [];
  const contato = lista.find(c => c.id === id);
  if (!contato) return;
  state.whatsappEtiquetas = state.whatsappEtiquetas.length ? state.whatsappEtiquetas : await api('/whatsapp/etiquetas') || [];
  const notas = await api(`/whatsapp/contatos/${id}/notas`) || [];
  renderDetalheContatoModal(contato, notas);
}

function renderDetalheContatoModal(contato, notas) {
  openModal(`
    <div class="modal-header"><h3>${contato.nome || contato.telefone}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Etapa do funil</label>
        <select class="form-select" onchange="mudarEtapaContatoModal(${contato.id}, this.value)">
          ${FUNIL_ETAPAS.map(e => `<option value="${e}" ${contato.etapa_funil === e ? 'selected' : ''}>${e}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Etiquetas</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${state.whatsappEtiquetas.length === 0 ? '<span class="text-muted" style="font-size:12px;">Nenhuma etiqueta cadastrada ainda.</span>' : state.whatsappEtiquetas.map(t => {
            const ativo = (contato.etiquetas || []).some(ct => ct.id === t.id);
            return `<span class="wa-tag-pill selectable ${ativo ? 'active' : ''}" style="--tag-color:${t.cor};" onclick="toggleEtiquetaContato(${contato.id}, ${t.id}, ${!ativo})">${t.nome}</span>`;
          }).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Anotações (histórico de atividade)</label>
        <div class="wa-notas-list">
          ${notas.length === 0 ? '<p class="text-muted" style="font-size:12px;">Nenhuma anotação ainda.</p>' : notas.map(n => `
            <div class="wa-nota-item">
              <div class="wa-nota-texto">${n.texto}</div>
              <div class="wa-nota-quando">${timeAgo(n.criado_em)}</div>
            </div>
          `).join('')}
        </div>
        <textarea class="form-textarea" id="novaNotaContato" placeholder="Adicionar uma anotação..." style="margin-top:10px;"></textarea>
        <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="adicionarNotaContato(${contato.id})">+ Adicionar anotação</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

async function mudarEtapaContatoModal(id, etapa) {
  await api(`/whatsapp/contatos/${id}/etapa`, { method: 'PUT', body: JSON.stringify({ etapa_funil: etapa }) });
  toast('Etapa do funil atualizada');
}

async function toggleEtiquetaContato(contatoId, etiquetaId, ativo) {
  const contato = await api(`/whatsapp/contatos/${contatoId}/etiquetas`, { method: 'POST', body: JSON.stringify({ etiqueta_id: etiquetaId, ativo }) });
  const notas = await api(`/whatsapp/contatos/${contatoId}/notas`) || [];
  if (contato) renderDetalheContatoModal(contato, notas);
}

async function adicionarNotaContato(contatoId) {
  const campo = $('#novaNotaContato');
  const texto = campo.value.trim();
  if (!texto) return;
  await api(`/whatsapp/contatos/${contatoId}/notas`, { method: 'POST', body: JSON.stringify({ texto }) });
  const lista = await api('/whatsapp/contatos') || [];
  const contato = lista.find(c => c.id === contatoId);
  const notas = await api(`/whatsapp/contatos/${contatoId}/notas`) || [];
  toast('Anotação adicionada');
  if (contato) renderDetalheContatoModal(contato, notas);
}

/* ---------------- Etiquetas ---------------- */
async function renderWhatsappEtiquetas() {
  state.whatsappEtiquetas = await api('/whatsapp/etiquetas') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovaEtiquetaModal()">+ Nova etiqueta</button>`;

  const rows = state.whatsappEtiquetas.map(t => `
    <tr>
      <td><span class="wa-tag-pill" style="background:${t.cor}22;color:${t.cor};">${t.nome}</span></td>
      <td><span style="display:inline-block;width:16px;height:16px;border-radius:5px;background:${t.cor};border:1px solid var(--border);vertical-align:middle;margin-right:6px;"></span>${t.cor}</td>
      <td>
        <div class="action-icons">
          <button title="Editar" onclick="editEtiqueta(${t.id})">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteEtiqueta(${t.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    ${renderWhatsappTabs('whatsapp-etiquetas')}
    <div class="table-wrap">
      ${state.whatsappEtiquetas.length === 0 ? `
        <div class="empty-state"><div class="icon">🏷️</div><h4>Nenhuma etiqueta criada</h4><p>Crie etiquetas para organizar os contatos do CRM (ex: Cliente VIP, Aguardando resposta).</p></div>
      ` : `<table><thead><tr><th>Etiqueta</th><th>Cor</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table>`}
    </div>
  `;
}

function openNovaEtiquetaModal() {
  openModal(`
    <div class="modal-header"><h3>Nova etiqueta</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <form id="formEtiqueta">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="nome" placeholder="Ex: Cliente VIP" required></div>
        <div class="form-group"><label class="form-label">Cor</label><input class="form-input" type="color" name="cor" value="#6C5CE0"></div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEtiqueta()">Salvar</button>
    </div>
  `);
}
async function submitEtiqueta() {
  const form = $('#formEtiqueta');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/whatsapp/etiquetas', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Etiqueta criada!'); closeModal(); renderWhatsappEtiquetas(); }
}
function editEtiqueta(id) {
  const t = state.whatsappEtiquetas.find(x => x.id === id);
  if (!t) return;
  openModal(`
    <div class="modal-header"><h3>Editar etiqueta</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <form id="formEtiqueta">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="nome" value="${t.nome}" required></div>
        <div class="form-group"><label class="form-label">Cor</label><input class="form-input" type="color" name="cor" value="${t.cor}"></div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEditEtiqueta(${id})">Salvar</button>
    </div>
  `);
}
async function submitEditEtiqueta(id) {
  const form = $('#formEtiqueta');
  const data = Object.fromEntries(new FormData(form));
  const result = await api(`/whatsapp/etiquetas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result) { toast('Etiqueta atualizada!'); closeModal(); renderWhatsappEtiquetas(); }
}
async function deleteEtiqueta(id) {
  if (!confirm('Deseja realmente excluir esta etiqueta?')) return;
  const result = await api(`/whatsapp/etiquetas/${id}`, { method: 'DELETE' });
  if (result) { toast('Etiqueta removida'); renderWhatsappEtiquetas(); }
}

/* ---------------- Modelos de mensagem (templates) ---------------- */
const WHATSAPP_TEMPLATE_CATEGORIAS = ['Marketing', 'Utilidade', 'Autenticação'];

async function renderWhatsappTemplates() {
  state.whatsappTemplates = await api('/whatsapp/templates') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovoTemplateModal()">+ Novo modelo</button>`;

  const rows = state.whatsappTemplates.map(t => `
    <tr>
      <td><strong>${t.nome}</strong><div class="text-muted" style="font-size:11px;">${t.corpo.slice(0, 70)}${t.corpo.length > 70 ? '…' : ''}</div></td>
      <td>${t.categoria || '—'}</td>
      <td>${timeAgo(t.criado_em)}</td>
      <td>
        <div class="action-icons">
          <button title="Editar" onclick="editTemplateWhatsapp(${t.id})">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteTemplateWhatsapp(${t.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    ${renderWhatsappTabs('whatsapp-templates')}
    <div class="table-wrap">
      ${state.whatsappTemplates.length === 0 ? `
        <div class="empty-state"><div class="icon">📄</div><h4>Nenhum modelo criado</h4><p>Crie modelos de mensagem reutilizáveis, com variáveis como {{nome}}. Depois é possível enviar esses modelos para aprovação da Meta.</p></div>
      ` : `<table><thead><tr><th>Modelo</th><th>Categoria</th><th>Criado em</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table>`}
    </div>
  `;
}

function openNovoTemplateModal() {
  openModal(`
    <div class="modal-header"><h3>Novo modelo de mensagem</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <form id="formTemplate">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="nome" placeholder="Ex: boas_vindas" required></div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select class="form-select" name="categoria">${WHATSAPP_TEMPLATE_CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Corpo da mensagem</label>
          <textarea class="form-textarea" name="corpo" placeholder="Ex: Olá {{nome}}, sua proposta está pronta!" required></textarea>
          <p class="form-hint">Use {{variavel}} para campos dinâmicos, ex: {{nome}}</p>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitTemplateWhatsapp()">Salvar</button>
    </div>
  `);
}
async function submitTemplateWhatsapp() {
  const form = $('#formTemplate');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/whatsapp/templates', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Modelo criado!'); closeModal(); renderWhatsappTemplates(); }
}
function editTemplateWhatsapp(id) {
  const t = state.whatsappTemplates.find(x => x.id === id);
  if (!t) return;
  openModal(`
    <div class="modal-header"><h3>Editar modelo</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <form id="formTemplate">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="nome" value="${t.nome}" required></div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select class="form-select" name="categoria">${WHATSAPP_TEMPLATE_CATEGORIAS.map(c => `<option value="${c}" ${t.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Corpo da mensagem</label>
          <textarea class="form-textarea" name="corpo" required>${t.corpo}</textarea>
          <p class="form-hint">Use {{variavel}} para campos dinâmicos, ex: {{nome}}</p>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEditTemplateWhatsapp(${id})">Salvar</button>
    </div>
  `);
}
async function submitEditTemplateWhatsapp(id) {
  const form = $('#formTemplate');
  const data = Object.fromEntries(new FormData(form));
  const result = await api(`/whatsapp/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result) { toast('Modelo atualizado!'); closeModal(); renderWhatsappTemplates(); }
}
async function deleteTemplateWhatsapp(id) {
  if (!confirm('Deseja realmente excluir este modelo?')) return;
  const result = await api(`/whatsapp/templates/${id}`, { method: 'DELETE' });
  if (result) { toast('Modelo removido'); renderWhatsappTemplates(); }
}

/* ---------------- Métricas de conversão ---------------- */
async function renderWhatsappMetricas() {
  $('#topbarActions').innerHTML = '';
  const metricas = await api('/whatsapp/metricas') || { etapas: FUNIL_ETAPAS, por_etapa: {}, contatos_por_dia: [] };
  const porEtapa = metricas.por_etapa || {};
  const maxEtapa = Math.max(1, ...Object.values(porEtapa));

  const conversoes = [];
  for (let i = 0; i < FUNIL_ETAPAS.length - 1; i++) {
    if (FUNIL_ETAPAS[i] === 'Perdido') continue;
    const atual = porEtapa[FUNIL_ETAPAS[i]] || 0;
    const prox = porEtapa[FUNIL_ETAPAS[i + 1]] || 0;
    conversoes.push({ de: FUNIL_ETAPAS[i], para: FUNIL_ETAPAS[i + 1], taxa: atual ? Math.round((prox / atual) * 100) : 0 });
  }

  const porDiaMap = {};
  (metricas.contatos_por_dia || []).forEach(l => { porDiaMap[l.dia] = l.c; });
  const ultimos30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const chave = d.toISOString().slice(0, 10);
    ultimos30.push({ dia: chave, c: porDiaMap[chave] || 0 });
  }
  const maxDia = Math.max(1, ...ultimos30.map(x => x.c));

  $('#content').innerHTML = `
    ${renderWhatsappTabs('whatsapp-metricas')}
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><span class="card-title">Contatos por etapa do funil</span></div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${FUNIL_ETAPAS.map(e => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>${e}</span><strong>${porEtapa[e] || 0}</strong></div>
            <div style="background:var(--bg);border-radius:6px;height:10px;overflow:hidden;">
              <div style="height:100%;width:${Math.round((porEtapa[e] || 0) / maxEtapa * 100)}%;background:var(--primary);"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><span class="card-title">Taxa de conversão entre etapas</span></div>
      <div class="grid grid-3" style="gap:14px;">
        ${conversoes.map(c => `
          <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;text-align:center;">
            <div class="text-muted" style="font-size:11px;">${c.de} → ${c.para}</div>
            <div class="stat-value" style="font-size:22px;">${c.taxa}%</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Novos contatos (últimos 30 dias)</span></div>
      <div style="display:flex;align-items:flex-end;gap:2px;height:100px;">
        ${ultimos30.map(x => `<div style="flex:1;background:${x.c ? 'var(--primary)' : 'var(--bg)'};height:${Math.max(4, Math.round(x.c / maxDia * 100))}%;border-radius:2px 2px 0 0;" title="${x.dia}: ${x.c}"></div>`).join('')}
      </div>
    </div>
  `;
}

/* ---------------- Configurações da API do WhatsApp Cloud ---------------- */
async function renderWhatsappConfig() {
  $('#topbarActions').innerHTML = '';
  state.whatsappConfig = await api('/whatsapp/config') || {};
  const c = state.whatsappConfig;

  $('#content').innerHTML = `
    ${renderWhatsappTabs('whatsapp-config')}
    <div class="card" style="max-width:640px;">
      <div class="card-header"><span class="card-title">Configuração da API do WhatsApp Cloud (Meta)</span></div>
      <p class="text-muted" style="font-size:12px;margin-bottom:16px;">Esses dados são obtidos no seu app do WhatsApp Business, no Meta for Developers.</p>
      <form id="formWhatsappConfig">
        <div class="form-group">
          <label class="form-label">Phone Number ID</label>
          <input class="form-input" name="phone_number_id" value="${c.phone_number_id || ''}" placeholder="Ex: 123456789012345">
        </div>
        <div class="form-group">
          <label class="form-label">WhatsApp Business Account ID (WABA)</label>
          <input class="form-input" name="waba_id" value="${c.waba_id || ''}" placeholder="Ex: 987654321098765">
        </div>
        <div class="form-group">
          <label class="form-label">Access Token (token permanente)</label>
          <input class="form-input" type="password" name="access_token" value="${c.access_token || ''}" placeholder="EAAG...">
        </div>
        <div class="form-group">
          <label class="form-label">Webhook Verify Token</label>
          <input class="form-input" name="webhook_verify_token" value="${c.webhook_verify_token || ''}" placeholder="Defina uma palavra-chave qualquer">
          <p class="form-hint">Use o mesmo valor ao configurar o Webhook no painel da Meta. URL do webhook: <code>${location.origin}/api/public/whatsapp/webhook</code></p>
        </div>
      </form>
    </div>
    <button class="btn btn-primary" style="margin-top:16px;" onclick="salvarWhatsappConfig()">💾 Salvar configuração</button>
  `;
}
async function salvarWhatsappConfig() {
  const form = $('#formWhatsappConfig');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/whatsapp/config', { method: 'PUT', body: JSON.stringify(data) });
  if (result) { state.whatsappConfig = result; toast('Configuração salva!'); }
}

/* ---------------- Modal: Minha Conta ---------------- */
function openMinhaContaModal(tab = 'info') {
  const prefs = JSON.parse(localStorage.getItem('midia_indoor_prefs') || '{}');
  const userName = $('#userName').textContent;
  const userEmail = $('#userEmail').textContent;
  const userInitial = userName.charAt(0).toUpperCase();

  openModal(`
    <div class="modal-header">
      <h3>Minha conta</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-tabs">
      <div class="modal-tab ${tab === 'info' ? 'active' : ''}" data-tab="info" onclick="switchContaTab('info')">ⓘ Info</div>
      <div class="modal-tab ${tab === 'config' ? 'active' : ''}" data-tab="config" onclick="switchContaTab('config')">⚙️ Configurações</div>
    </div>
    <div class="modal-body" id="contaTabBody">
      ${tab === 'info' ? contaInfoTab(userName, userEmail, userInitial) : contaConfigTab(prefs)}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarConta()">💾 Salvar</button>
    </div>
  `);
}

function contaInfoTab(userName, userEmail, userInitial) {
  return `
    <form id="formConta">
      <div class="form-group">
        <label class="form-label">Imagem</label>
        <div class="user-avatar" style="width:90px;height:90px;font-size:34px;border-radius:16px;">${userInitial}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Nome</label>
        <input class="form-input" name="nome" value="${userName}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" value="${userEmail}" disabled>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nova senha</label>
          <input class="form-input" name="nova_senha" type="password" placeholder="••••••••">
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar senha</label>
          <input class="form-input" name="confirmar_senha" type="password" placeholder="••••••••">
        </div>
      </div>
      <p class="form-hint">Deixe em branco caso não queira alterar a senha</p>
    </form>
  `;
}

function contaConfigTab(prefs) {
  const freq = prefs.frequencia || 'semanal';
  return `
    <form id="formContaConfig">
      <div class="form-group">
        <label class="form-label">Fuso horário</label>
        <select class="form-select" name="fuso_horario">
          <option value="America/Sao_Paulo" ${prefs.fuso_horario !== 'America/Fortaleza' ? 'selected' : ''}>America/Sao_Paulo</option>
          <option value="America/Fortaleza" ${prefs.fuso_horario === 'America/Fortaleza' ? 'selected' : ''}>America/Fortaleza</option>
        </select>
      </div>

      <div class="form-group d-flex justify-between align-center">
        <label class="form-label mb-0">Receber notificações por email</label>
        <label style="position:relative;display:inline-block;width:40px;height:22px;">
          <input type="checkbox" name="notif_email" ${prefs.notif_email !== false ? 'checked' : ''} style="opacity:0;width:0;height:0;" id="notifEmailCheck">
          <span onclick="document.getElementById('notifEmailCheck').click(); this.style.background = document.getElementById('notifEmailCheck').checked ? 'var(--primary)' : 'var(--border)'; this.querySelector('span').style.transform = document.getElementById('notifEmailCheck').checked ? 'translateX(18px)' : 'translateX(2px)';" style="position:absolute;inset:0;background:${prefs.notif_email !== false ? 'var(--primary)' : 'var(--border)'};border-radius:22px;cursor:pointer;transition:.15s;">
            <span style="position:absolute;height:18px;width:18px;left:0;bottom:2px;background:#fff;border-radius:50%;transition:.15s;transform:translateX(${prefs.notif_email !== false ? '18px' : '2px'});"></span>
          </span>
        </label>
      </div>

      <div class="form-group">
        <label class="form-label">Frequência de envio</label>
        <div style="display:flex;gap:10px;">
          <div class="select-card ${freq === 'semanal' ? 'selected' : ''}" style="flex:1;padding:12px;cursor:pointer;" onclick="setFreq(this,'semanal')">${freq === 'semanal' ? '✓ ' : ''}Semanal</div>
          <div class="select-card ${freq === 'diario' ? 'selected' : ''}" style="flex:1;padding:12px;cursor:pointer;" onclick="setFreq(this,'diario')">${freq === 'diario' ? '✓ ' : ''}Diário</div>
        </div>
        <input type="hidden" name="frequencia" id="freqInput" value="${freq}">
      </div>

      <div class="form-group">
        <label class="form-label">Imagem tela de login (site)</label>
        <div class="upload-box">📤 Escolher arquivo...<br><span style="font-size:11px;">Tamanho sugerido: 600x800px</span></div>
      </div>

      <div class="form-group d-flex justify-between align-center">
        <label class="form-label mb-0">Personalizar imagem de inicialização</label>
        <input type="checkbox" name="custom_splash" ${prefs.custom_splash ? 'checked' : ''}>
      </div>

      <div class="form-group d-flex justify-between align-center">
        <label class="form-label mb-0">Exibir rodapé</label>
        <input type="checkbox" name="exibir_rodape" ${prefs.exibir_rodape ? 'checked' : ''}>
      </div>
    </form>
  `;
}

function setFreq(el, value) {
  $all('.select-card').forEach(c => { c.classList.remove('selected'); c.textContent = c.textContent.replace('✓ ', ''); });
  el.classList.add('selected');
  el.textContent = '✓ ' + el.textContent;
  $('#freqInput').value = value;
}

function switchContaTab(tab) {
  $all('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const prefs = JSON.parse(localStorage.getItem('midia_indoor_prefs') || '{}');
  const userName = $('#userName').textContent;
  const userEmail = $('#userEmail').textContent;
  const userInitial = userName.charAt(0).toUpperCase();
  $('#contaTabBody').innerHTML = tab === 'info' ? contaInfoTab(userName, userEmail, userInitial) : contaConfigTab(prefs);
}

async function salvarConta() {
  const infoForm = $('#formConta');
  if (infoForm) {
    const data = Object.fromEntries(new FormData(infoForm));
    if (data.nova_senha || data.confirmar_senha) {
      if (data.nova_senha !== data.confirmar_senha) {
        toast('As senhas não coincidem', 'error');
        return;
      }
    }
    const result = await api('/me', {
      method: 'PUT',
      body: JSON.stringify({ nome: data.nome, nova_senha: data.nova_senha || undefined }),
    });
    if (result) {
      $('#userName').textContent = result.nome;
      $('#userAvatar').textContent = result.nome.charAt(0).toUpperCase();
      toast('Conta atualizada!');
      closeModal();
    }
    return;
  }

  const configForm = $('#formContaConfig');
  if (configForm) {
    const data = Object.fromEntries(new FormData(configForm));
    data.notif_email = configForm.notif_email.checked;
    data.custom_splash = configForm.custom_splash.checked;
    data.exibir_rodape = configForm.exibir_rodape.checked;
    localStorage.setItem('midia_indoor_prefs', JSON.stringify(data));
    toast('Configurações salvas!');
    closeModal();
  }
}

/* ---------------- Init ---------------- */
(async function init() {
  const user = await checkAuth();
  if (!user) return; // já foi redirecionado para login

  $('#userName').textContent = user.nome;
  $('#userEmail').textContent = user.email;
  $('#userAvatar').textContent = user.nome.charAt(0).toUpperCase();

  navigate('dashboard');
})();
