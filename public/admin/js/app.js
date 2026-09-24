/* ============================================================
   Mídia Indoor — Admin App (SPA simples, sem build step)
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
};

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
  planos: ['Home', 'Planos'],
  relatorios: ['Home', 'Relatórios'],
  configuracoes: ['Home', 'Configurações'],
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
    if (collapsed) $('#conteudosSubmenu').style.display = 'none';
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
    case 'campanhas': return renderCampanhas();
    case 'midias': return renderMidias();
    case 'grupos': return renderGrupos();
    case 'conteudos-dinamicos': return renderConteudosDinamicos();
    case 'instagram': return renderInstagram();
    case 'rss': return renderRSS();
    case 'avisos': return renderEmConstrucao('🔔', 'Avisos', 'Crie avisos rápidos e urgentes para exibição imediata em todas as telas.');
    case 'utilitarios': return renderEmConstrucao('🧰', 'Utilitários', 'Ferramentas extras: relógio, previsão do tempo, cotações e contadores.');
    case 'clientes': return renderClientes();
    case 'planos': return renderPlanos();
    case 'relatorios': return renderRelatorios();
    case 'configuracoes': return renderConfiguracoes();
    default: content.innerHTML = '<p>View não encontrada</p>';
  }
}

/* ---------------- Dashboard ---------------- */
async function renderDashboard() {
  const stats = await api('/stats') || { telas_online: 0, telas_offline: 0, telas_total: 0, campanhas_ativas: 0, exibicoes_hoje: 0 };
  const content = $('#content');
  const pctOnline = stats.telas_total ? Math.round(stats.telas_online / stats.telas_total * 100) : 0;

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
          ${dias.map(d => `
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;">
              <div style="width:100%;height:36px;background:var(--bg);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden;">
                <div style="width:100%;height:${Math.round(Math.random()*20)}%;background:var(--primary);border-radius:6px 6px 0 0;"></div>
              </div>
              <span style="font-size:10px;color:var(--text-muted);">${d.slice(0,3).toLowerCase()}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Seu plano</span></div>
        <div class="stat-value" style="font-size:26px;">∞ <span style="font-size:14px;color:var(--text-muted);font-weight:500;">/ 3</span></div>
        <a href="#" onclick="navigate('planos');return false;" style="font-size:12px;font-weight:700;color:var(--primary);display:inline-block;margin:6px 0 16px;">Amplie sua rede agora →</a>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
          ${stats.telas_total ? `${stats.telas_total} tela(s) cadastrada(s)` : 'Nenhuma tela cadastrada ainda.'}
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
async function renderTelas() {
  state.telas = await api('/telas') || [];
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovaTelaModal()">+ Nova Tela</button>`;

  const filtered = state.telas.filter(t => {
    if (state.filtroTelas === 'online') return t.status === 'online';
    if (state.filtroTelas === 'offline') return t.status !== 'online';
    return true;
  });

  const onlineCount = state.telas.filter(t => t.status === 'online').length;
  const offlineCount = state.telas.length - onlineCount;

  const rows = filtered.map(t => `
    <tr>
      <td><strong>${t.nome}</strong><div class="text-muted" style="font-size:11px;">${t.localizacao || '—'}</div></td>
      <td><span class="status-pill ${t.status === 'online' ? 'online' : 'offline'}">${t.status === 'online' ? 'Online' : 'Offline'}</span></td>
      <td>${t.orientacao || 'Horizontal'}</td>
      <td>${timeAgo(t.ultima_comunicacao)}</td>
      <td>
        <div class="action-icons">
          <button title="Editar" onclick="editTela(${t.id})">✏️</button>
          <button title="Excluir" class="danger" onclick="deleteTela(${t.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

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
          <thead><tr><th>Tela</th><th>Status</th><th>Orientação</th><th>Última comunicação</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

function setFiltroTelas(f) { state.filtroTelas = f; renderTelas(); }

function openNovaTelaModal() {
  openModal(`
    <div class="modal-header">
      <h3>Nova Tela</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formTela">
        <div class="form-group">
          <label class="form-label">Nome da tela</label>
          <input class="form-input" name="nome" placeholder="Ex: TV Loja Centro" required>
        </div>
        <div class="form-group">
          <label class="form-label">Localização</label>
          <input class="form-input" name="localizacao" placeholder="Ex: Viçosa do Ceará - CE">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Orientação</label>
            <select class="form-select" name="orientacao">
              <option value="Horizontal">Horizontal</option>
              <option value="Vertical">Vertical</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Grupo de mídia</label>
            <select class="form-select" name="grupo_id">
              <option value="">Nenhum</option>
            </select>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitTela()">Salvar Tela</button>
    </div>
  `);
}

async function submitTela() {
  const form = $('#formTela');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/telas', { method: 'POST', body: JSON.stringify(data) });
  if (result) {
    toast('Tela cadastrada com sucesso!');
    closeModal();
    renderTelas();
  }
}

async function deleteTela(id) {
  if (!confirm('Deseja realmente excluir esta tela?')) return;
  const result = await api(`/telas/${id}`, { method: 'DELETE' });
  if (result) { toast('Tela removida'); renderTelas(); }
}

function editTela(id) {
  const tela = state.telas.find(t => t.id === id);
  if (!tela) return;
  openModal(`
    <div class="modal-header">
      <h3>Editar Tela</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formTela">
        <div class="form-group">
          <label class="form-label">Nome da tela</label>
          <input class="form-input" name="nome" value="${tela.nome}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Localização</label>
          <input class="form-input" name="localizacao" value="${tela.localizacao || ''}">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEditTela(${id})">Salvar</button>
    </div>
  `);
}

async function submitEditTela(id) {
  const form = $('#formTela');
  const data = Object.fromEntries(new FormData(form));
  const result = await api(`/telas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result) { toast('Tela atualizada'); closeModal(); renderTelas(); }
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
async function renderMidias() {
  state.midias = await api('/midias') || [];
  $('#topbarActions').innerHTML = `
    <button class="btn btn-secondary" onclick="navigate('grupos')">🗂️ Grupos</button>
    <button class="btn btn-primary" onclick="openNovaMidiaModal()">+ Nova mídia</button>
  `;

  const rows = state.midias.map(m => `
    <tr>
      <td><strong>${m.nome}</strong><div class="text-muted" style="font-size:11px;">${tipoLabel(m.tipo)}</div></td>
      <td>${midiaQtdTelas(m.id)}</td>
      <td>${m.orientacao || 'Paisagem'}</td>
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

function openNovaMidiaModal() {
  openModal(`
    <div class="modal-header">
      <h3>Nova mídia</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="grid grid-4" style="gap:12px;">
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="openMidiaFormModal('imagem')">
          <div style="font-size:26px;">🎞️</div>Vídeo/imagem
        </div>
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="openMidiaFormModal('youtube')">
          <div style="font-size:26px;">▶️</div>Vídeo YouTube
        </div>
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="openMidiaFormModal('link')">
          <div style="font-size:26px;">🔗</div>Link externo
        </div>
        <div class="select-card" style="padding:20px 10px;text-align:center;cursor:pointer;" onclick="openMidiaFormModal('programatica')">
          <div style="font-size:26px;">📡</div>Mídia programática
        </div>
      </div>
    </div>
  `);
}

function openMidiaFormModal(tipo) {
  const labels = {
    imagem: { titulo: 'Vídeo/imagem', urlLabel: 'Arquivo', urlPlaceholder: 'Escolher arquivo...' },
    youtube: { titulo: 'Vídeo YouTube', urlLabel: 'URL do vídeo', urlPlaceholder: 'https://youtube.com/watch?v=...' },
    link: { titulo: 'Link externo', urlLabel: 'URL', urlPlaceholder: 'https://exemplo.com' },
    programatica: { titulo: 'Mídia programática', urlLabel: 'Tag / URL do parceiro', urlPlaceholder: 'https://...' },
  }[tipo];

  openModal(`
    <div class="modal-header">
      <h3>Nova mídia — ${labels.titulo}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formMidia">
        <input type="hidden" name="tipo" value="${tipo}">
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input class="form-input" name="nome" placeholder="Ex: Promoção de verão" required>
        </div>
        <div class="form-group">
          <label class="form-label">${labels.urlLabel}</label>
          <input class="form-input" name="url" placeholder="${labels.urlPlaceholder}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Orientação</label>
          <select class="form-select" name="orientacao">
            <option value="Paisagem">Paisagem</option>
            <option value="Retrato">Retrato</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="openNovaMidiaModal()">← Voltar</button>
      <button class="btn btn-primary" onclick="submitMidia()">Salvar mídia</button>
    </div>
  `);
}

async function submitMidia() {
  const form = $('#formMidia');
  const data = Object.fromEntries(new FormData(form));
  const result = await api('/midias', { method: 'POST', body: JSON.stringify(data) });
  if (result) { toast('Mídia cadastrada!'); closeModal(); renderMidias(); }
}

function editMidia(id) {
  const m = state.midias.find(x => x.id === id);
  if (!m) return;
  openModal(`
    <div class="modal-header">
      <h3>Editar mídia</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="formMidiaEdit">
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input class="form-input" name="nome" value="${m.nome}" required>
        </div>
        <div class="form-group">
          <label class="form-label">URL</label>
          <input class="form-input" name="url" value="${m.url || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Orientação</label>
          <select class="form-select" name="orientacao">
            <option value="Paisagem" ${m.orientacao !== 'Retrato' ? 'selected' : ''}>Paisagem</option>
            <option value="Retrato" ${m.orientacao === 'Retrato' ? 'selected' : ''}>Retrato</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" name="status">
            <option value="ativo" ${m.status !== 'inativo' ? 'selected' : ''}>Ativo</option>
            <option value="inativo" ${m.status === 'inativo' ? 'selected' : ''}>Inativo</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitEditMidia(${id})">Salvar</button>
    </div>
  `);
}

async function submitEditMidia(id) {
  const form = $('#formMidiaEdit');
  const data = Object.fromEntries(new FormData(form));
  const result = await api(`/midias/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result) { toast('Mídia atualizada!'); closeModal(); renderMidias(); }
}

async function deleteMidia(id) {
  if (!confirm('Deseja realmente excluir esta mídia?')) return;
  const result = await api(`/midias/${id}`, { method: 'DELETE' });
  if (result) { toast('Mídia removida'); renderMidias(); }
}

/* ---------------- Grupos de mídia ---------------- */
async function renderGrupos() {
  state.grupos = await api('/grupos') || [];
  state.midias = state.midias.length ? state.midias : (await api('/midias') || []);
  state.telas = state.telas.length ? state.telas : (await api('/telas') || []);
  $('#topbarActions').innerHTML = `<button class="btn btn-primary" onclick="openNovoGrupoModal()">+ Novo grupo</button>`;

  const rows = state.grupos.map(g => {
    const qtdMidias = JSON.parse(g.midias_ids || '[]').length;
    return `
    <tr>
      <td><strong>${g.nome}</strong></td>
      <td>${qtdMidias} mídia(s)</td>
      <td><span class="status-pill ${g.status === 'ativo' ? 'online' : 'offline'}">${g.status || 'ativo'}</span></td>
      <td>${timeAgo(g.criado_em)}</td>
      <td>
        <div class="action-icons">
          <button title="Excluir" class="danger" onclick="deleteGrupo(${g.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  $('#content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar" style="justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm">🔽 Filtros</button>
      </div>
      ${state.grupos.length === 0 ? `
        <div class="empty-state">
          <div class="icon">🗂️</div>
          <h4>Nenhum registro encontrado</h4>
          <p>A consulta solicitada não retornou nenhum registro para ser exibido.</p>
        </div>
      ` : `
        <table>
          <thead><tr><th>Grupo</th><th>Mídias</th><th>Status</th><th>Última alteração</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `;
}

function openNovoGrupoModal(tab = 'info', selMidias = [], selTelas = []) {
  openModal(`
    <div class="modal-header">
      <h3>Novo grupo</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-tabs">
      <div class="modal-tab ${tab === 'info' ? 'active' : ''}" onclick="openNovoGrupoModal('info', ${JSON.stringify(selMidias)}, ${JSON.stringify(selTelas)})">ⓘ Info</div>
      <div class="modal-tab ${tab === 'rapida' ? 'active' : ''}" onclick="openNovoGrupoModal('rapida', ${JSON.stringify(selMidias)}, ${JSON.stringify(selTelas)})">🔒 Inclusão rápida</div>
    </div>
    <div class="modal-body">
      ${tab === 'info' ? `
        <form id="formGrupo">
          <div class="form-group">
            <label class="form-label">Imagem</label>
            <div class="upload-box">📤 Escolher arquivo...</div>
          </div>
          <div class="form-group">
            <label class="form-label">Nome</label>
            <input class="form-input" name="nome" placeholder="Ex: Loterias Caixa" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mídias</label>
            <input class="form-input" placeholder="Busque pelo nome da mídia..." list="listaMidias">
            <datalist id="listaMidias">${state.midias.map(m => `<option value="${m.nome}">`).join('')}</datalist>
          </div>
          ${selMidias.length ? `<p class="text-muted" style="font-size:12px;">${selMidias.length} mídia(s) selecionada(s)</p>` : ''}
          <p class="form-hint">O conteúdo só será reproduzido à tela de mesma orientação</p>
        </form>
      ` : `
        <div class="form-group">
          <div style="font-weight:600;margin-bottom:6px;">🔒 Inclusão rápida</div>
          <p class="text-muted" style="font-size:12px;">Quer economizar tempo? Use esta opção pra incluir essa mídia em várias telas de uma vez só, sem precisar incluir uma por uma depois. A mídia sempre irá para o final da playlist.</p>
          <label class="form-label">Telas disponíveis</label>
          <input class="form-input" placeholder="Busque pelo nome da tela..." list="listaTelas">
          <datalist id="listaTelas">${state.telas.map(t => `<option value="${t.nome}">`).join('')}</datalist>
        </div>
      `}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitGrupo()">💾 Salvar</button>
    </div>
  `);
}

async function submitGrupo() {
  const form = $('#formGrupo');
  const nome = form ? form.nome.value : ($('#content') && '');
  if (!nome) { toast('Informe o nome do grupo', 'error'); return; }
  const result = await api('/grupos', { method: 'POST', body: JSON.stringify({ nome }) });
  if (result) { toast('Grupo criado!'); closeModal(); renderGrupos(); }
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

/* ---------------- Planos ---------------- */
function renderPlanos() {
  $('#content').innerHTML = `
    <div class="grid grid-3">
      <div class="card">
        <div class="icon-box purple">🎯</div>
        <h3 style="margin:14px 0 6px;">Básico</h3>
        <div class="stat-value">Grátis</div>
        <p class="text-muted" style="margin:12px 0;">Até 1 tela • Suporte básico</p>
        <button class="btn btn-secondary" style="width:100%;">Plano atual</button>
      </div>
      <div class="card" style="border-color:var(--primary);">
        <div class="icon-box purple">🚀</div>
        <h3 style="margin:14px 0 6px;">Profissional</h3>
        <div class="stat-value">R$ 99<span style="font-size:14px;color:var(--text-muted);">/mês</span></div>
        <p class="text-muted" style="margin:12px 0;">Até 10 telas • Relatórios avançados</p>
        <button class="btn btn-primary" style="width:100%;">Assinar agora</button>
      </div>
      <div class="card">
        <div class="icon-box purple">💎</div>
        <h3 style="margin:14px 0 6px;">Enterprise</h3>
        <div class="stat-value">Sob consulta</div>
        <p class="text-muted" style="margin:12px 0;">Telas ilimitadas • Suporte dedicado</p>
        <button class="btn btn-secondary" style="width:100%;">Falar com vendas</button>
      </div>
    </div>
  `;
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
function renderRelatorios() {
  $('#content').innerHTML = `
    <div class="table-wrap">
      <div class="empty-state">
        <div class="icon">📈</div>
        <h4>Relatórios em construção</h4>
        <p>Em breve você poderá acompanhar estatísticas detalhadas de exibição por tela e campanha.</p>
      </div>
    </div>
  `;
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

/* ---------------- Configurações ---------------- */
function renderConfiguracoes() {
  $('#content').innerHTML = `
    <div class="card" style="max-width:500px;">
      <div class="card-header"><span class="card-title">Perfil</span></div>
      <div class="form-group">
        <label class="form-label">Nome</label>
        <input class="form-input" value="Marcos" disabled>
      </div>
      <div class="form-group">
        <label class="form-label">E-mail</label>
        <input class="form-input" value="solarsenergias@gmail.com" disabled>
      </div>
      <button class="btn btn-secondary">Alterar senha</button>
    </div>
  `;
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
