/* ═══════════════════════════════════════════════════════════════
   LUMEN PASSAGENS — forms.js
   Formulários: nova solicitação, detalhes, fornecedores, ações
   ═══════════════════════════════════════════════════════════════ */

let reprovarTargetId = null;
let comprarTargetId  = null;
let fornecedorEditId = null;

// ─── NOVA SOLICITAÇÃO ─────────────────────────────────────────────
function initNovaForm() {
  document.getElementById("n-solicitante").value = currentUser?.name || "";
  ["n-passageiro","n-origem","n-destino","n-saida","n-retorno","n-pix","n-obs"]
    .forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  const turno = document.getElementById("n-turno");
  const motivo = document.getElementById("n-motivo");
  const bagagem = document.getElementById("n-bagagem");
  if(turno)  turno.value  = "";
  if(motivo) motivo.value = "";
  if(bagagem) bagagem.value = "nao";
  document.getElementById("media-historica-wrap").innerHTML = "";
  document.getElementById("policy-warn").classList.remove("visible");
  document.getElementById("tipo-onibus").checked = true;
  updateTipoLabels();
}

function onTipoChange() { updateTipoLabels(); checkPolicy(); }

function updateTipoLabels() {
  const isOnibus = document.getElementById("tipo-onibus").checked;
  const lblO = document.getElementById("lbl-onibus");
  const lblA = document.getElementById("lbl-aviao");
  lblO.style.borderColor = isOnibus ? "var(--lumen)" : "var(--border)";
  lblO.style.background  = isOnibus ? "var(--lumen-lt)" : "";
  lblA.style.borderColor = !isOnibus ? "var(--lumen)" : "var(--border)";
  lblA.style.background  = !isOnibus ? "var(--lumen-lt)" : "";
}

function checkPolicy() {
  const tipo  = document.getElementById("tipo-aviao").checked ? "aviao" : "onibus";
  const saida = document.getElementById("n-saida").value;
  const warn  = document.getElementById("policy-warn");
  if (!saida) { warn.classList.remove("visible"); return; }
  const diff  = Math.ceil((new Date(saida+"T00:00:00") - new Date()) / 86400000);
  const limit = tipo === "aviao" ? 7 : 3;
  if (diff < limit) {
    warn.textContent = `⚠️ Política Lumen: passagens de ${tipo==="aviao"?"avião":"ônibus"} devem ser solicitadas com ${limit} dias de antecedência (faltam ${Math.max(0,diff)} dia(s)). Justifique nas observações.`;
    warn.classList.add("visible");
  } else {
    warn.classList.remove("visible");
  }
}

function onRotaChange() {
  const origem  = document.getElementById("n-origem").value.trim();
  const destino = document.getElementById("n-destino").value.trim();
  const wrap    = document.getElementById("media-historica-wrap");
  if (origem.length > 3 && destino.length > 3) {
    const media = calcMediaHistorica(origem, destino);
    const count = countRotaHistory(origem, destino);
    if (media > 0) {
      wrap.innerHTML = `<div class="media-chip">📊 Média histórica neste trajeto: <strong>${fmtBRL(media)}</strong> <span style="font-size:11px;opacity:0.7">(${count} compra(s))</span></div>`;
    } else {
      wrap.innerHTML = `<div class="media-chip" style="background:#f0f0f0;color:var(--text-muted)">📊 Sem histórico neste trajeto ainda</div>`;
    }
  } else {
    wrap.innerHTML = "";
  }
}

async function submitSolicitacao() {
  const tipo       = document.getElementById("tipo-aviao").checked ? "aviao" : "onibus";
  const passageiro = document.getElementById("n-passageiro").value.trim();
  const origem     = document.getElementById("n-origem").value.trim();
  const destino    = document.getElementById("n-destino").value.trim();
  const saida      = document.getElementById("n-saida").value;
  const turno      = document.getElementById("n-turno").value;
  const motivo     = document.getElementById("n-motivo").value;
  if (!passageiro||!origem||!destino||!saida||!turno||!motivo) {
    toast("Preencha todos os campos obrigatórios.","error"); return;
  }
  const codigo = gerarCodigo();
  const data = {
    codigo, tipo,
    solicitante:    currentUser.name,
    solicitanteUid: currentUser.uid,
    passageiro, origem, destino, saida,
    retorno:  document.getElementById("n-retorno").value,
    turno, motivo,
    bagagem:  document.getElementById("n-bagagem").value,
    pix:      document.getElementById("n-pix").value.trim(),
    obs:      document.getElementById("n-obs").value.trim(),
    status:   "pendente",
    orcamentos: [{},{},{}],
    historico: [{ acao:"Solicitação criada", usuario:currentUser.name, ts:new Date().toISOString() }],
    criadoEm:  firebase.firestore.FieldValue.serverTimestamp(),
    valorFinal: null, fornecedor: null, dataCompra: null,
    ticketImg: null, numBilhete: null
  };
  try {
    await db.collection("passagens_solicitacoes").add(data);
    toast("Solicitação enviada com sucesso! ✈️","success");
    goPage("minhas");
  } catch(e) {
    toast("Erro ao salvar solicitação.","error");
    console.error(e);
  }
}

// ─── MODAL DETALHES ───────────────────────────────────────────────
function openDetalhes(id) {
  const s = allSolicitacoes.find(x => x.id === id);
  if (!s) return;

  document.getElementById("det-title").textContent = `${s.passageiro} — ${s.origem} → ${s.destino}`;
  document.getElementById("det-code").textContent  = `${s.codigo||"—"} · Criado em ${fmtDateTime(s.criadoEm)}`;

  const isAdmin = currentRole === "admin";

  // Timeline
  const steps   = ["pendente","em_analise","aprovada","comprada","concluida"];
  const curIdx  = s.status === "reprovada" ? -1 : steps.indexOf(s.status);
  const stepLbls = { pendente:"Pendente", em_analise:"Em Análise", aprovada:"Aprovada", comprada:"Comprada", concluida:"Concluída" };
  let tl = '<div class="status-timeline">';
  steps.forEach((st,i) => {
    let cls = "";
    if (s.status==="reprovada" && i<=1) cls="rejected";
    else if (i < curIdx) cls = "done";
    else if (i === curIdx) cls = "current";
    tl += `<div class="timeline-step"><div class="timeline-wrap"><div class="timeline-dot ${cls}">${cls==="done"?"✓":i+1}</div><div class="timeline-label">${stepLbls[st]}</div></div>`;
    if (i < steps.length-1) tl += `<div class="timeline-line ${i<curIdx?"done":""}"></div>`;
    tl += "</div>";
  });
  if (s.status==="reprovada") tl += '<div class="timeline-wrap"><div class="timeline-dot rejected">✕</div><div class="timeline-label">Reprovada</div></div>';
  tl += "</div>";

  let html = tl;

  // Dados
  html += `<div class="section-title">Dados da Viagem</div>`;
  html += `<div class="info-box-wrap">
    ${iBox("Tipo",`<span class="type-icon type-${s.tipo}">${s.tipo==="aviao"?"✈️ Avião":"🚌 Ônibus"}</span>`)}
    ${iBox("Motivo",`<span class="badge badge-info">${s.motivo}</span>`)}
    ${iBox("Status",`<span class="badge status-${s.status}">${STATUS_LABELS[s.status]||s.status}</span>`)}
    ${iBox("Solicitante",esc(s.solicitante))}
    ${iBox("Passageiro",esc(s.passageiro))}
    ${iBox("Origem",esc(s.origem))}
    ${iBox("Destino",esc(s.destino))}
    ${iBox("Data Saída",fmtDate(s.saida))}
    ${iBox("Data Retorno",s.retorno?fmtDate(s.retorno):"—")}
    ${iBox("Turno",s.turno||"—")}
    ${iBox("Bagagem",s.bagagem==="sim"?"✅ Sim":"❌ Não")}
    ${s.pix ? iBox("PIX Alimentação",esc(s.pix)) : ""}
  </div>`;

  if (s.obs) html += `<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Observações</div><div style="background:var(--bg);padding:10px 14px;border-radius:8px;font-size:13px">${esc(s.obs)}</div></div>`;

  // Motivo de reprovação
  if (s.status==="reprovada" && s.motivoReprovacao) {
    html += `<div class="alert-banner" style="margin-top:12px"><div class="alert-banner-icon">❌</div><div><div class="alert-banner-title">Motivo da Reprovação</div><div class="alert-banner-text">${esc(s.motivoReprovacao)}</div></div></div>`;
  }

  // Média histórica
  const media = calcMediaHistorica(s.origem, s.destino);
  if (media > 0) html += `<div class="media-chip" style="margin-top:12px">📊 Média histórica: <strong>${fmtBRL(media)}</strong></div>`;

  // Links online (admin)
  if (isAdmin) {
    html += `<div class="section-title">Pesquisar Preços Online</div><div class="online-links">`;
    if (s.tipo === "aviao") {
      html += lnk("Decolar","https://www.decolar.com/passagens-aereas/")
           +  lnk("GOL","https://www.voegol.com.br/")
           +  lnk("LATAM","https://www.latamairlines.com/br/")
           +  lnk("Azul","https://www.voeazul.com.br/")
           +  lnk("Google Flights","https://www.google.com/travel/flights");
    } else {
      html += lnk("ClickBus","https://www.clickbus.com.br/")
           +  lnk("Buser","https://www.buser.com.br/")
           +  lnk("RedeBus","https://www.redebuspassagens.com.br/");
    }
    html += "</div>";
  }

  // Orçamentos
  html += `<div class="section-title">Orçamentos</div><div class="quotes-grid">`;
  for (let i = 0; i < 3; i++) {
    const orc = ((s.orcamentos)||[{},{},{}])[i] || {};
    const sel = s.orcamentoSelecionado === i;
    if (isAdmin) {
      html += `<div class="quote-card ${sel?"selected":""}" id="quote-card-${i}">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span class="quote-num">Orçamento ${i+1}</span>
          ${sel?'<span class="badge badge-ok">✓ Selecionado</span>':""}
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <input class="form-input" id="orc-forn-${i}" value="${esc(orc.fornecedor||"")}" placeholder="Fornecedor" style="padding:8px">
        </div>
        <div class="form-row" style="gap:8px">
          <div class="form-group" style="margin-bottom:8px">
            <input class="form-input" id="orc-val-${i}" type="number" step="0.01" value="${orc.valor||""}" placeholder="Valor R$" style="padding:8px">
          </div>
          <div class="form-group" style="margin-bottom:8px">
            <input class="form-input" id="orc-prazo-${i}" value="${esc(orc.prazo||"")}" placeholder="Prazo" style="padding:8px">
          </div>
        </div>
        <input class="form-input" id="orc-obs-${i}" value="${esc(orc.obs||"")}" placeholder="Obs." style="padding:8px;margin-bottom:8px">
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="saveOrcamento('${s.id}',${i})">Salvar</button>
          ${orc.valor&&!sel?`<button class="btn btn-ok btn-sm" onclick="selectOrcamento('${s.id}',${i})">Selecionar</button>`:""}
        </div>
      </div>`;
    } else {
      html += `<div class="quote-card ${sel?"selected":""}">
        <div class="quote-num">Orçamento ${i+1}${sel?' <span class="badge badge-ok">✓</span>':""}</div>
        <div class="quote-price">${orc.valor?fmtBRL(orc.valor):"—"}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${orc.fornecedor||"Não informado"}</div>
      </div>`;
    }
  }
  html += "</div>";

  // Dados da compra
  if (s.valorFinal) {
    html += `<div class="section-title">Dados da Compra</div>`;
    html += `<div class="info-box-wrap">
      ${iBox("Valor Pago",`<strong style="color:var(--ok)">${fmtBRL(s.valorFinal)}</strong>`)}
      ${iBox("Fornecedor",esc(s.fornecedor||"—"))}
      ${iBox("Data da Compra",fmtDate(s.dataCompra))}
      ${s.numBilhete?iBox("Nº Bilhete",esc(s.numBilhete)):""}
    </div>`;
    if (s.ticketImg) html += `<img src="${s.ticketImg}" style="max-width:100%;border-radius:8px;border:1px solid var(--border);margin-top:10px">`;
    if (media > 0) {
      const eco = media - parseFloat(s.valorFinal);
      html += `<div class="media-chip" style="margin-top:10px;background:${eco>=0?"var(--ok-bg)":"var(--danger-bg)"};color:${eco>=0?"var(--ok)":"var(--danger)"}">
        ${eco>=0?"💰 Economia":"📈 Acima da média"}: <strong>${fmtBRL(Math.abs(eco))}</strong>
      </div>`;
    }
  }

  // Histórico
  if ((s.historico||[]).length) {
    html += `<div class="section-title">Histórico</div><ul class="history-list">`;
    s.historico.slice().reverse().forEach(h => {
      html += `<li class="history-item">
        <div class="history-dot"></div>
        <div><strong>${esc(h.acao)}</strong> — ${esc(h.usuario)}</div>
        <div class="history-time">${fmtHistoryDate(h.ts)}</div>
      </li>`;
    });
    html += "</ul>";
  }

  document.getElementById("det-body").innerHTML = html;

  // Footer actions
  const footer = document.getElementById("det-footer");
  footer.innerHTML = "";
  if (isAdmin) {
    if (s.status === "pendente") {
      footer.innerHTML += `<button class="btn btn-secondary btn-sm" onclick="changeStatus('${s.id}','em_analise')">🔍 Analisar</button>`;
      footer.innerHTML += `<button class="btn btn-danger btn-sm" onclick="openReprovar('${s.id}')">✕ Reprovar</button>`;
      footer.innerHTML += `<button class="btn btn-ok btn-sm" onclick="changeStatus('${s.id}','aprovada')">✓ Aprovar</button>`;
    } else if (s.status === "em_analise") {
      footer.innerHTML += `<button class="btn btn-danger btn-sm" onclick="openReprovar('${s.id}')">✕ Reprovar</button>`;
      footer.innerHTML += `<button class="btn btn-ok btn-sm" onclick="changeStatus('${s.id}','aprovada')">✓ Aprovar</button>`;
    } else if (s.status === "aprovada") {
      footer.innerHTML += `<button class="btn btn-sm" style="background:var(--purple);color:#fff" onclick="openComprar('${s.id}')">🎫 Registrar Compra</button>`;
    } else if (s.status === "comprada") {
      footer.innerHTML += `<button class="btn btn-ok btn-sm" onclick="changeStatus('${s.id}','concluida')">✅ Concluir Viagem</button>`;
    }
    footer.innerHTML += `<button class="btn btn-gemini btn-sm" onclick="askAI('Analise esta solicitação: passageiro ${esc(s.passageiro)}, trajeto ${esc(s.origem)} → ${esc(s.destino)}, data ${fmtDate(s.saida)}, tipo ${s.tipo}, status ${STATUS_LABELS[s.status]||s.status}. Dê insights e recomendações.')">✨ Gemini Analisa</button>`;
    if (!["concluida","reprovada"].includes(s.status)) {
      footer.innerHTML += `<button class="btn btn-outline btn-sm" onclick="exportSolicitacaoPDF('${s.id}')">📄 PDF</button>`;
    }
  }

  openModal("modal-detalhes");
}

// ─── AÇÕES DE STATUS ─────────────────────────────────────────────
async function changeStatus(id, newStatus, extra={}) {
  const entry = { acao:`Status → ${STATUS_LABELS[newStatus]}`, usuario:currentUser.name, ts:new Date().toISOString() };
  await db.collection("passagens_solicitacoes").doc(id).update({
    status: newStatus, ...extra,
    historico: firebase.firestore.FieldValue.arrayUnion(entry)
  });
  toast(`Status atualizado: ${STATUS_LABELS[newStatus]}`,"success");
  closeModal("modal-detalhes");
}

function openReprovar(id) {
  reprovarTargetId = id;
  document.getElementById("reprovar-motivo").value = "";
  openModal("modal-reprovar");
}

async function confirmReprovar() {
  const motivo = document.getElementById("reprovar-motivo").value.trim();
  if (!motivo) { toast("Informe o motivo da reprovação.","error"); return; }
  await changeStatus(reprovarTargetId, "reprovada", { motivoReprovacao: motivo });
  closeModal("modal-reprovar");
}

// ─── MODAL COMPRAR ────────────────────────────────────────────────
function openComprar(id) {
  comprarTargetId  = id;
  compraImageBase64 = null;
  document.getElementById("compra-preview").style.display = "none";
  document.getElementById("compra-valor").value   = "";
  document.getElementById("compra-data").value    = new Date().toISOString().slice(0,10);
  document.getElementById("compra-bilhete").value = "";
  document.getElementById("compra-obs").value     = "";
  document.getElementById("compra-budget-alert").innerHTML = "";

  // Popular fornecedores filtrados por tipo
  const s    = allSolicitacoes.find(x => x.id === id);
  const tipo = s?.tipo;
  const sel  = document.getElementById("compra-fornecedor");
  sel.innerHTML = "<option value=''>Selecione...</option>" +
    allFornecedores
      .filter(f => f.ativo !== false && (!tipo || f.tipo === tipo || f.tipo === "ambos"))
      .map(f => `<option value="${esc(f.nome)}">${esc(f.nome)}</option>`)
      .join("");
  openModal("modal-comprar");
}

function checkBudgetOnPurchase() {
  const val = parseFloat(document.getElementById("compra-valor").value)||0;
  if (!val || !orcamentoConfig.totalMensal) return;
  const gastoAtual = getGastoMes(getMonthKey());
  const gastoFuturo = gastoAtual + val;
  const limite = orcamentoConfig.totalMensal;
  const pct    = (gastoFuturo / limite) * 100;
  const div    = document.getElementById("compra-budget-alert");
  if (pct >= 100) {
    div.innerHTML = `<div class="alert-banner" style="margin:10px 0"><div class="alert-banner-icon">🚨</div><div><div class="alert-banner-title">Esta compra ultrapassa o orçamento!</div><div class="alert-banner-text">Total após compra: ${fmtBRL(gastoFuturo)} (${pct.toFixed(0)}% do limite de ${fmtBRL(limite)})</div></div></div>`;
  } else if (pct >= 80) {
    div.innerHTML = `<div class="alert-banner warn" style="margin:10px 0"><div class="alert-banner-icon">⚠️</div><div><div class="alert-banner-title">Atenção: ${pct.toFixed(0)}% do orçamento após esta compra</div><div class="alert-banner-text">Restará: ${fmtBRL(Math.max(0,limite-gastoFuturo))}</div></div></div>`;
  } else {
    div.innerHTML = "";
  }
}

async function confirmCompra() {
  const valor      = parseFloat(document.getElementById("compra-valor").value);
  const fornecedor = document.getElementById("compra-fornecedor").value;
  const dataCompra = document.getElementById("compra-data").value;
  if (!valor || valor <= 0 || !fornecedor || !dataCompra) {
    toast("Preencha todos os campos obrigatórios.","error"); return;
  }
  await db.collection("passagens_solicitacoes").doc(comprarTargetId).update({
    status:     "comprada",
    valorFinal:  valor,
    fornecedor,
    dataCompra,
    numBilhete: document.getElementById("compra-bilhete").value,
    obsCompra:  document.getElementById("compra-obs").value,
    ticketImg:  compraImageBase64 || null,
    historico:  firebase.firestore.FieldValue.arrayUnion({
      acao: `Passagem comprada — ${fmtBRL(valor)} via ${fornecedor}`,
      usuario: currentUser.name,
      ts: new Date().toISOString()
    })
  });
  toast("Compra registrada com sucesso! 🎫","success");
  closeModal("modal-comprar");
  closeModal("modal-detalhes");
}

// ─── ORÇAMENTOS ───────────────────────────────────────────────────
async function saveOrcamento(id, idx) {
  const forn  = document.getElementById(`orc-forn-${idx}`).value.trim();
  const valor = parseFloat(document.getElementById(`orc-val-${idx}`).value)||0;
  const prazo = document.getElementById(`orc-prazo-${idx}`).value.trim();
  const obs   = document.getElementById(`orc-obs-${idx}`).value.trim();
  const s     = allSolicitacoes.find(x => x.id === id);
  if (!s) return;
  const orcs  = [...((s.orcamentos)||[{},{},{}])];
  while (orcs.length < 3) orcs.push({});
  orcs[idx] = { fornecedor:forn, valor, prazo, obs };
  await db.collection("passagens_solicitacoes").doc(id).update({ orcamentos: orcs });
  toast("Orçamento salvo!","success");
}

async function selectOrcamento(id, idx) {
  await db.collection("passagens_solicitacoes").doc(id).update({ orcamentoSelecionado: idx });
  toast("Orçamento selecionado!","success");
  openDetalhes(id);
}

// ─── FORNECEDORES ─────────────────────────────────────────────────
function renderFornecedores() {
  const list = document.getElementById("fornecedores-list");
  if (!allFornecedores.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🏢</div>
      <div class="empty-state-title">Nenhum fornecedor cadastrado</div>
      <button class="btn btn-primary btn-sm" onclick="openFornecedorModal()" style="margin-top:12px">+ Adicionar Fornecedor</button>
    </div>`;
    return;
  }
  list.innerHTML = allFornecedores.map(f => `
    <div class="supplier-card">
      <div>
        <div class="supplier-name">
          ${esc(f.nome)}
          <span class="badge ${f.ativo!==false?"badge-ok":"badge-gray"}" style="margin-left:6px">${f.ativo!==false?"Ativo":"Inativo"}</span>
        </div>
        <div class="supplier-meta">
          <span class="type-icon type-${f.tipo==="ambos"?"onibus":f.tipo}" style="font-size:10px">${f.tipo==="ambos"?"✈️🚌 Ambos":f.tipo==="aviao"?"✈️ Avião":"🚌 Ônibus"}</span>
          ${f.tel   ? ` · 📞 ${esc(f.tel)}`   : ""}
          ${f.email ? ` · ✉️ ${esc(f.email)}` : ""}
          ${f.prazo ? ` · 💳 ${esc(f.prazo)}` : ""}
        </div>
        ${f.pix  ? `<div class="supplier-meta">PIX: ${esc(f.pix)}</div>` : ""}
        ${f.site ? `<div class="supplier-meta"><a href="${f.site}" target="_blank" style="color:var(--lumen)">🌐 ${esc(f.site)}</a></div>` : ""}
        ${f.obs  ? `<div class="supplier-meta" style="margin-top:4px;font-style:italic">${esc(f.obs)}</div>` : ""}
      </div>
      <div class="supplier-actions">
        <button class="btn btn-secondary btn-sm" onclick="openFornecedorModal('${f.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm"    onclick="deleteFornecedor('${f.id}')">🗑️</button>
      </div>
    </div>`).join("");
}

function openFornecedorModal(id=null) {
  fornecedorEditId = id;
  document.getElementById("forn-modal-title").textContent = id ? "Editar Fornecedor" : "Novo Fornecedor";
  if (id) {
    const f = allFornecedores.find(x => x.id === id);
    if (f) {
      document.getElementById("forn-nome").value  = f.nome  || "";
      document.getElementById("forn-tipo").value  = f.tipo  || "onibus";
      document.getElementById("forn-tel").value   = f.tel   || "";
      document.getElementById("forn-email").value = f.email || "";
      document.getElementById("forn-pix").value   = f.pix   || "";
      document.getElementById("forn-site").value  = f.site  || "";
      document.getElementById("forn-prazo").value = f.prazo || "";
      document.getElementById("forn-obs").value   = f.obs   || "";
      document.getElementById("forn-ativo").value = f.ativo===false ? "false" : "true";
    }
  } else {
    ["forn-nome","forn-tel","forn-email","forn-pix","forn-site","forn-prazo","forn-obs"]
      .forEach(id2 => document.getElementById(id2).value = "");
    document.getElementById("forn-tipo").value  = "onibus";
    document.getElementById("forn-ativo").value = "true";
  }
  openModal("modal-fornecedor");
}

async function saveFornecedor() {
  const nome = document.getElementById("forn-nome").value.trim();
  if (!nome) { toast("Informe o nome do fornecedor.","error"); return; }
  const data = {
    nome,
    tipo:  document.getElementById("forn-tipo").value,
    tel:   document.getElementById("forn-tel").value.trim(),
    email: document.getElementById("forn-email").value.trim(),
    pix:   document.getElementById("forn-pix").value.trim(),
    site:  document.getElementById("forn-site").value.trim(),
    prazo: document.getElementById("forn-prazo").value.trim(),
    obs:   document.getElementById("forn-obs").value.trim(),
    ativo: document.getElementById("forn-ativo").value === "true",
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (fornecedorEditId) {
    await db.collection("passagens_fornecedores").doc(fornecedorEditId).update(data);
  } else {
    data.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection("passagens_fornecedores").add(data);
  }
  await loadFornecedoresData();
  renderFornecedores();
  closeModal("modal-fornecedor");
  toast(fornecedorEditId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!","success");
}

async function deleteFornecedor(id) {
  if (!confirm("Excluir este fornecedor?")) return;
  await db.collection("passagens_fornecedores").doc(id).delete();
  await loadFornecedoresData();
  renderFornecedores();
  toast("Fornecedor removido.","success");
}
