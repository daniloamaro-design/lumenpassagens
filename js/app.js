/* ═══════════════════════════════════════════════════════════════
   LUMEN PASSAGENS — app.js
   Estado global, autenticação, navegação e utilitários
   ═══════════════════════════════════════════════════════════════ */

// ─── ESTADO GLOBAL ────────────────────────────────────────────────
let currentUser     = null;
let currentRole     = "user";
let allSolicitacoes = [];
let allFornecedores = [];
let allUsers        = [];
let orcamentoConfig = {};
let unsubSolicitacoes = null;
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
const chartInstances = {};

// ─── TOAST ────────────────────────────────────────────────────────
function toast(msg, type = "info", dur = 3500) {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity 0.3s";
    setTimeout(() => t.remove(), 300);
  }, dur);
}

// ─── AUTH ─────────────────────────────────────────────────────────
function showPane(p) {
  ["login","register","pending"].forEach(x => {
    document.getElementById("pane-"+x).style.display = x === p ? "" : "none";
  });
}

async function doLogin() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-pass").value;
  const err   = document.getElementById("login-err");
  err.className = "alert alert-danger";
  if (!email || !pass) { err.textContent = "Preencha e-mail e senha."; err.classList.add("visible"); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    err.textContent = "E-mail ou senha inválidos."; err.classList.add("visible");
  }
}

async function doRegister() {
  const name  = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const pass  = document.getElementById("reg-pass").value;
  const err   = document.getElementById("reg-err");
  err.className = "alert alert-danger";
  if (!name||!email||!pass) { err.textContent = "Preencha todos os campos."; err.classList.add("visible"); return; }
  if (pass.length < 6)      { err.textContent = "Senha mínima: 6 caracteres."; err.classList.add("visible"); return; }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await db.collection("users").doc(cred.user.uid).set({
      name, email, role:"user", approved:false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showPane("pending");
  } catch(e) {
    err.textContent = e.code === "auth/email-already-in-use" ? "E-mail já cadastrado." : "Erro ao criar conta.";
    err.classList.add("visible");
  }
}

function doLogout() {
  if (unsubSolicitacoes) unsubSolicitacoes();
  auth.signOut();
}

auth.onAuthStateChanged(async user => {
  if (!user) {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app-screen").style.display  = "none";
    showPane("login");
    return;
  }
  const snap = await db.collection("users").doc(user.uid).get();
  if (!snap.exists || !snap.data().approved) {
    showPane("pending");
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app-screen").style.display  = "none";
    return;
  }
  currentUser = { uid: user.uid, ...snap.data() };
  currentRole = snap.data().role || "user";
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display  = "block";
  document.getElementById("topbar-user").textContent   = currentUser.name;
  applyRoleVisibility();
  await loadFornecedoresData();
  await loadOrcamentoConfig();
  startListener();
  goPage(currentRole === "admin" ? "dashboard" : "nova");
  populateYearFilters();
  loadTheme();
});

function applyRoleVisibility() {
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = currentRole === "admin" ? "" : "none";
  });
}

// ─── FIRESTORE LISTENER ───────────────────────────────────────────
function startListener() {
  if (unsubSolicitacoes) unsubSolicitacoes();
  unsubSolicitacoes = db.collection("passagens_solicitacoes")
    .orderBy("criadoEm","desc")
    .onSnapshot(snap => {
      allSolicitacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateBadge();
      checkBudgetAlerts();
      const active = document.querySelector(".page.active");
      if (active) refreshPage(active.id.replace("page-",""));
    });
}

async function loadFornecedoresData() {
  const snap = await db.collection("passagens_fornecedores").get();
  allFornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadOrcamentoConfig() {
  try {
    const snap = await db.collection("configuracoes").doc("orcamento").get();
    orcamentoConfig = snap.exists ? snap.data() : {};
  } catch(e) { orcamentoConfig = {}; }
}

function updateBadge() {
  const n = allSolicitacoes.filter(s => s.status === "pendente").length;
  const b = document.getElementById("badge-pendente");
  b.style.display = n > 0 ? "" : "none";
  b.textContent = n;
}

// ─── NAVEGAÇÃO ────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:    "Dashboard",
  gerenciar:    "Todas as Solicitações",
  nova:         "Nova Solicitação",
  minhas:       "Minhas Solicitações",
  financeiro:   "Controle Financeiro",
  orcamento:    "Orçamento & Alertas",
  fornecedores: "Fornecedores",
  indicadores:  "Indicadores",
  calendario:   "Calendário de Viagens",
  usuarios:     "Usuários"
};

function goPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".sidebar-item").forEach(b => b.classList.remove("active"));
  const pg = document.getElementById("page-"+id);
  if (pg) pg.classList.add("active");
  document.querySelectorAll(".sidebar-item").forEach(b => {
    if (b.getAttribute("onclick")?.includes(`'${id}'`)) b.classList.add("active");
  });
  document.getElementById("topbar-title").textContent = PAGE_TITLES[id] || id;
  refreshPage(id);
  // fechar sidebar mobile
  document.querySelector(".sidebar")?.classList.remove("open");
  document.querySelector(".sidebar-overlay")?.classList.remove("open");
}

function refreshPage(id) {
  if (id === "dashboard")    renderDashboard();
  if (id === "gerenciar")    renderGerenciar();
  if (id === "minhas")       renderMinhas();
  if (id === "financeiro")   renderFinanceiro();
  if (id === "orcamento")    renderOrcamento();
  if (id === "indicadores")  renderIndicadores();
  if (id === "calendario")   renderCalendario();
  if (id === "usuarios")     renderUsuarios();
  if (id === "fornecedores") renderFornecedores();
  if (id === "nova")         initNovaForm();
}

function populateYearFilters() {
  const years = [...new Set(allSolicitacoes.map(s => {
    const d = s.saida ? new Date(s.saida+"T00:00:00") : null;
    return d ? d.getFullYear() : new Date().getFullYear();
  }))];
  const cur = new Date().getFullYear();
  if (!years.includes(cur)) years.push(cur);
  years.sort((a,b) => b-a);
  ["fin-filter-ano","ind-filter-ano"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  });
}

// ─── SIDEBAR / THEME ─────────────────────────────────────────────
function toggleSidebar() {
  if (window.innerWidth <= 900) {
    document.querySelector(".sidebar").classList.toggle("open");
    document.querySelector(".sidebar-overlay").classList.toggle("open");
  } else {
    document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem("sidebar-collapsed", document.body.classList.contains("sidebar-collapsed"));
  }
}

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("dark-mode", document.body.classList.contains("dark-mode"));
}

function loadTheme() {
  if (localStorage.getItem("dark-mode") === "true")          document.body.classList.add("dark-mode");
  if (localStorage.getItem("sidebar-collapsed") === "true")  document.body.classList.add("sidebar-collapsed");
}

// ─── HELPERS ─────────────────────────────────────────────────────
function fmtBRL(v) { return Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtDate(d) { if(!d) return "—"; const [y,m,dy] = d.split("-"); return `${dy}/${m}/${y}`; }
function fmtDateTime(ts) {
  if (!ts) return "—";
  if (typeof ts === "string") return new Date(ts).toLocaleString("pt-BR");
  if (ts.toDate) return ts.toDate().toLocaleString("pt-BR");
  return "—";
}
function fmtHistoryDate(ts) {
  if (!ts) return "—";
  if (typeof ts === "string") return new Date(ts).toLocaleString("pt-BR");
  return "—";
}
function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function gerarCodigo() { return "PAS-"+Date.now().toString(36).toUpperCase().slice(-6); }
function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
function getMonthKey()  {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

// Fechar modal clicando no overlay
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });

  // Sidebar overlay click
  document.querySelector(".sidebar-overlay")?.addEventListener("click", () => {
    document.querySelector(".sidebar")?.classList.remove("open");
    document.querySelector(".sidebar-overlay")?.classList.remove("open");
  });

  // Enter no login
  document.getElementById("login-pass")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
});

// ─── ORÇAMENTO: helpers ───────────────────────────────────────────
function getGastoMes(mesKey) {
  const [ano, mes] = mesKey.split("-").map(Number);
  return allSolicitacoes
    .filter(s => ["comprada","concluida"].includes(s.status) && s.valorFinal && s.dataCompra)
    .filter(s => {
      const d = new Date(s.dataCompra+"T00:00:00");
      return d.getFullYear()===ano && d.getMonth()===(mes-1);
    })
    .reduce((a,s) => a+(parseFloat(s.valorFinal)||0), 0);
}

function getGastoMesPorFornecedor(mesKey, fornecedorNome) {
  const [ano, mes] = mesKey.split("-").map(Number);
  return allSolicitacoes
    .filter(s => ["comprada","concluida"].includes(s.status) && s.valorFinal && s.dataCompra && s.fornecedor===fornecedorNome)
    .filter(s => {
      const d = new Date(s.dataCompra+"T00:00:00");
      return d.getFullYear()===ano && d.getMonth()===(mes-1);
    })
    .reduce((a,s) => a+(parseFloat(s.valorFinal)||0), 0);
}

function calcMediaHistorica(origem, destino) {
  const o = origem.toLowerCase().split(" - ")[0];
  const d = destino.toLowerCase().split(" - ")[0];
  const match = allSolicitacoes.filter(s =>
    s.valorFinal && parseFloat(s.valorFinal) > 0 &&
    (s.origem||"").toLowerCase().includes(o) &&
    (s.destino||"").toLowerCase().includes(d)
  );
  if (!match.length) return 0;
  return match.reduce((a,s) => a+(parseFloat(s.valorFinal)||0), 0) / match.length;
}

function countRotaHistory(origem, destino) {
  const o = origem.toLowerCase().split(" - ")[0];
  const d = destino.toLowerCase().split(" - ")[0];
  return allSolicitacoes.filter(s =>
    s.valorFinal && parseFloat(s.valorFinal)>0 &&
    (s.origem||"").toLowerCase().includes(o) &&
    (s.destino||"").toLowerCase().includes(d)
  ).length;
}

function getBudgetFillClass(pct) {
  if (pct >= 80) return "budget-fill-danger";
  if (pct >= 60) return "budget-fill-warn";
  return "budget-fill-safe";
}

// ─── ALERTAS DE ORÇAMENTO (dashboard) ───────────────────────────
function checkBudgetAlerts() {
  if (!orcamentoConfig.totalMensal) return;
  const mesRef    = orcamentoConfig.mesRef || getMonthKey();
  const gasto     = getGastoMes(mesRef);
  const limite    = orcamentoConfig.totalMensal;
  const pct       = limite > 0 ? (gasto/limite)*100 : 0;
  const dashAlert = document.getElementById("budget-alert-dash");
  if (!dashAlert) return;
  if (pct >= 80) {
    dashAlert.innerHTML = `<div class="alert-banner"><div class="alert-banner-icon">🚨</div><div><div class="alert-banner-title">ALERTA CRÍTICO: ${pct.toFixed(1)}% do orçamento mensal utilizado!</div><div class="alert-banner-text">Gasto: ${fmtBRL(gasto)} de ${fmtBRL(limite)}. Considere pausar novas compras.</div></div></div>`;
  } else if (pct >= 60) {
    dashAlert.innerHTML = `<div class="alert-banner warn"><div class="alert-banner-icon">⚠️</div><div><div class="alert-banner-title">Atenção: ${pct.toFixed(1)}% do orçamento mensal atingido</div><div class="alert-banner-text">Gasto: ${fmtBRL(gasto)} de ${fmtBRL(limite)} disponíveis.</div></div></div>`;
  } else {
    dashAlert.innerHTML = "";
  }

  // alertas por fornecedor
  const fornBudgets = orcamentoConfig.fornBudgets || {};
  const fornAlerts = [];
  allFornecedores.filter(f => f.ativo !== false).forEach(f => {
    const cfg = fornBudgets[f.id] || {};
    if (!cfg.limite) return;
    const gF = getGastoMesPorFornecedor(mesRef, f.nome);
    const pF = (gF/cfg.limite)*100;
    if (pF >= 60) fornAlerts.push({ nome: f.nome, pct: pF, gasto: gF, limite: cfg.limite });
  });
  const fornAlert = document.getElementById("budget-alert-forn-dash");
  if (fornAlert && fornAlerts.length) {
    fornAlert.innerHTML = fornAlerts.map(a =>
      `<div class="alert-banner ${a.pct>=80?'':'warn'}" style="margin-bottom:8px">
        <div class="alert-banner-icon">${a.pct>=80?"🚨":"⚠️"}</div>
        <div><div class="alert-banner-title">${a.pct>=80?"CRÍTICO":"ATENÇÃO"}: Fornecedor "${esc(a.nome)}" — ${a.pct.toFixed(1)}% do limite</div>
        <div class="alert-banner-text">Gasto: ${fmtBRL(a.gasto)} de ${fmtBRL(a.limite)}</div></div>
      </div>`
    ).join("");
  } else if (fornAlert) {
    fornAlert.innerHTML = "";
  }
}

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────
let compraImageBase64 = null;

async function handleImageUpload(event, previewId) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 3*1024*1024) { toast("Imagem muito grande (máx. 3MB)","error"); return; }
  const compressed = await compressImage(file, 800, 0.7);
  compraImageBase64 = compressed;
  const preview = document.getElementById(previewId);
  preview.src = compressed;
  preview.style.display = "block";
}

function compressImage(file, maxW, quality) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW/img.width, maxW/img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        res(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── CHARTS ──────────────────────────────────────────────────────
function renderChart(canvasId, type, labels, datasets, extraOptions={}) {
  if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: type==="doughnut", position:"right", labels:{boxWidth:12,font:{size:11}} },
        tooltip: {
          callbacks: {
            label: ctx2 => {
              const v = ctx2.parsed?.y ?? ctx2.parsed ?? ctx2.raw;
              return typeof v === "number" && v > 1000 ? ` ${fmtBRL(v)}` : ` ${v}`;
            }
          }
        }
      },
      scales: type==="doughnut" ? {} : {
        x: { ticks:{font:{size:11}}, grid:{display:false} },
        y: { ticks:{font:{size:11}, callback: v => v > 999 ? `R$${(v/1000).toFixed(1)}k` : v}, grid:{color:"rgba(0,0,0,0.05)"} }
      },
      ...extraOptions
    }
  });
}

// ─── INFO BOX ────────────────────────────────────────────────────
function iBox(label, value) {
  return `<div class="info-box"><div class="info-box-label">${label}</div><div class="info-box-value">${value}</div></div>`;
}
function lnk(label, url) {
  return `<a class="online-link" href="${url}" target="_blank" rel="noopener">🔗 ${label}</a>`;
}
