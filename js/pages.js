/* ═══════════════════════════════════════════════════════════════
   LUMEN PASSAGENS — pages.js
   Funções de renderização de todas as páginas
   ═══════════════════════════════════════════════════════════════ */

// ─── DASHBOARD ────────────────────────────────────────────────────
function renderDashboard() {
  const today   = new Date(); today.setHours(0,0,0,0);
  const ano     = new Date().getFullYear();
  const mes     = new Date().getMonth();
  const compradas = allSolicitacoes.filter(s => ["comprada","concluida"].includes(s.status) && s.valorFinal);
  const gastoMes  = compradas.filter(s => {
    const d = s.dataCompra ? new Date(s.dataCompra+"T00:00:00") : null;
    return d && d.getMonth()===mes && d.getFullYear()===ano;
  }).reduce((a,s) => a+(parseFloat(s.valorFinal)||0), 0);
  const totalGasto = compradas.reduce((a,s) => a+(parseFloat(s.valorFinal)||0), 0);
  const aprovadas  = allSolicitacoes.filter(s=>["aprovada","comprada","concluida"].includes(s.status)).length;
  const taxa       = allSolicitacoes.length ? Math.round(aprovadas/allSolicitacoes.length*100) : 0;
  const limite     = orcamentoConfig.totalMensal || 0;
  const pct        = limite > 0 ? Math.min((gastoMes/limite)*100, 100) : 0;

  // KPIs
  document.getElementById("dash-kpis").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Solicitações</div><div class="stat-value lumen">${allSolicitacoes.length}</div><div class="stat-desc">Todas</div></div>
    <div class="stat-card"><div class="stat-label">Pendentes</div><div class="stat-value warn">${allSolicitacoes.filter(s=>s.status==="pendente").length}</div><div class="stat-desc">Aguardando aprovação</div></div>
    <div class="stat-card"><div class="stat-label">Aprovadas</div><div class="stat-value ok">${allSolicitacoes.filter(s=>s.status==="aprovada").length}</div><div class="stat-desc">Para compra</div></div>
    <div class="stat-card">
      <div class="stat-label">Gasto do Mês</div>
      <div class="stat-value ${pct>=80?"danger":pct>=60?"warn":"lumen"}" style="font-size:20px">${fmtBRL(gastoMes)}</div>
      <div class="stat-desc">${limite>0?pct.toFixed(0)+"% do orçamento":"Sem limite definido"}</div>
      ${limite>0?`<div class="budget-bar" style="margin-top:8px"><div class="budget-bar-fill ${getBudgetFillClass(pct)}" style="width:${pct}%"></div></div>`:""}
    </div>
    <div class="stat-card"><div class="stat-label">Gasto Total</div><div class="stat-value" style="font-size:20px">${fmtBRL(totalGasto)}</div><div class="stat-desc">Histórico</div></div>
    <div class="stat-card"><div class="stat-label">Taxa Aprovação</div><div class="stat-value ok">${taxa}%</div><div class="stat-desc">Aprovadas / Total</div></div>
  `;

  // Alertas urgentes (viagem próxima sem compra)
  const alerts = allSolicitacoes.filter(s => {
    if (s.status !== "aprovada") return false;
    const saida = new Date(s.saida+"T00:00:00");
    return Math.ceil((saida - today) / 86400000) >= 0 && Math.ceil((saida - today) / 86400000) <= 7;
  });
  document.getElementById("dash-alerts").innerHTML = alerts.length
    ? `<div class="alert-banner warn"><div class="alert-banner-icon">⚠️</div><div><div class="alert-banner-title">${alerts.length} viagem(ns) próxima(s) sem passagem comprada!</div><div class="alert-banner-text">${alerts.map(a=>`${esc(a.passageiro)} — ${esc(a.origem)} → ${esc(a.destino)} (${fmtDate(a.saida)})`).join(" | ")}</div></div></div>`
    : "";

  // Gráficos
  const gastosPorMes = Array(12).fill(0);
  compradas.forEach(s => {
    const d = s.dataCompra ? new Date(s.dataCompra+"T00:00:00") : null;
    if (d && d.getFullYear()===ano) gastosPorMes[d.getMonth()] += parseFloat(s.valorFinal)||0;
  });
  const datasets = [{ label:"Gasto (R$)", data:gastosPorMes, backgroundColor: gastosPorMes.map((_,i)=>i===mes?"#2B9FA8":"#9FD6DA"), borderRadius:6 }];
  if (limite>0) datasets.push({ type:"line", label:"Limite Mensal", data:Array(12).fill(limite), borderColor:"#C0392B", borderDash:[6,4], borderWidth:2, pointRadius:0, fill:false });
  renderChart("chart-gastos-mensais","bar",MESES,datasets);

  const statusCounts = {};
  allSolicitacoes.forEach(s => { statusCounts[s.status]=(statusCounts[s.status]||0)+1; });
  renderChart("chart-status","doughnut",
    Object.keys(statusCounts).map(k=>STATUS_LABELS[k]||k),
    [{ data:Object.values(statusCounts), backgroundColor:["#aaa","#D4890A","#2B9FA8","#6C3483","#1A7A44","#C0392B"] }]
  );

  // Recentes
  const recent = allSolicitacoes.slice(0,10);
  document.getElementById("dash-recent-tbody").innerHTML = recent.length
    ? recent.map(s=>`<tr>
        <td><span class="ticket-code">${s.codigo||"—"}</span></td>
        <td>${esc(s.passageiro)}</td>
        <td><div class="route-display">${esc(s.origem)}<span class="route-arrow">→</span>${esc(s.destino)}</div></td>
        <td><span class="type-icon type-${s.tipo}">${s.tipo==="aviao"?"✈️":"🚌"}</span></td>
        <td>${fmtDate(s.saida)}</td>
        <td><span class="badge status-${s.status}">${STATUS_LABELS[s.status]||s.status}</span></td>
      </tr>`).join("")
    : '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma solicitação</td></tr>';
}

// ─── GERENCIAR ─────────────────────────────────────────────────────
function renderGerenciar() {
  const busca  = (document.getElementById("filter-busca")?.value||"").toLowerCase();
  const status = document.getElementById("filter-status")?.value||"";
  const tipo   = document.getElementById("filter-tipo")?.value||"";
  const motivo = document.getElementById("filter-motivo")?.value||"";
  const de     = document.getElementById("filter-de")?.value||"";
  const ate    = document.getElementById("filter-ate")?.value||"";

  const list = allSolicitacoes.filter(s => {
    if (busca && !`${s.passageiro} ${s.origem} ${s.destino} ${s.solicitante} ${s.codigo}`.toLowerCase().includes(busca)) return false;
    if (status && s.status!==status) return false;
    if (tipo   && s.tipo!==tipo)     return false;
    if (motivo && s.motivo!==motivo) return false;
    if (de && s.saida < de) return false;
    if (ate && s.saida > ate) return false;
    return true;
  });

  document.getElementById("gerenciar-tbody").innerHTML = list.length
    ? list.map(s=>`<tr>
        <td><span class="ticket-code">${s.codigo||"—"}</span></td>
        <td>${esc(s.solicitante)}</td>
        <td>${esc(s.passageiro)}</td>
        <td><div class="route-display" style="font-size:12px">${esc(s.origem)}<span class="route-arrow">→</span>${esc(s.destino)}</div></td>
        <td><span class="type-icon type-${s.tipo}">${s.tipo==="aviao"?"✈️":"🚌"}</span></td>
        <td><span class="badge badge-info">${s.motivo}</span></td>
        <td>${fmtDate(s.saida)}</td>
        <td>${s.valorFinal?`<strong style="color:var(--ok)">${fmtBRL(s.valorFinal)}</strong>`:"—"}</td>
        <td><span class="badge status-${s.status}">${STATUS_LABELS[s.status]||s.status}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="openDetalhes('${s.id}')">Ver</button></td>
      </tr>`).join("")
    : '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma solicitação encontrada</td></tr>';
}

function clearFilters() {
  ["filter-busca","filter-status","filter-tipo","filter-motivo","filter-de","filter-ate"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  renderGerenciar();
}

// ─── MINHAS SOLICITAÇÕES ──────────────────────────────────────────
function renderMinhas() {
  const list = allSolicitacoes.filter(s=>s.solicitanteUid===currentUser.uid);
  document.getElementById("minhas-tbody").innerHTML = list.length
    ? list.map(s=>`<tr>
        <td><span class="ticket-code">${s.codigo||"—"}</span></td>
        <td>${esc(s.passageiro)}</td>
        <td><div class="route-display" style="font-size:12px">${esc(s.origem)}<span class="route-arrow">→</span>${esc(s.destino)}</div></td>
        <td><span class="type-icon type-${s.tipo}">${s.tipo==="aviao"?"✈️":"🚌"}</span></td>
        <td>${fmtDate(s.saida)}</td>
        <td><span class="badge status-${s.status}">${STATUS_LABELS[s.status]||s.status}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="openDetalhes('${s.id}')">Ver</button></td>
      </tr>`).join("")
    : `<tr><td colspan="7" style="text-align:center;padding:48px">
        <div class="empty-state-icon">✈️</div>
        <div class="empty-state-title">Nenhuma solicitação ainda</div>
        <button class="btn btn-primary btn-sm" onclick="goPage('nova')" style="margin-top:10px">+ Nova Solicitação</button>
      </td></tr>`;
}

// ─── FINANCEIRO ───────────────────────────────────────────────────
function renderFinanceiro() {
  const ano = parseInt(document.getElementById("fin-filter-ano")?.value||new Date().getFullYear());
  const compradas = allSolicitacoes.filter(s=>["comprada","concluida"].includes(s.status)&&s.valorFinal&&s.dataCompra);
  const doAno = compradas.filter(s=>new Date(s.dataCompra+"T00:00:00").getFullYear()===ano);
  const totalAno   = doAno.reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);
  const totOnibus  = doAno.filter(s=>s.tipo==="onibus").reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);
  const totAviao   = doAno.filter(s=>s.tipo==="aviao").reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);
  const avgTicket  = doAno.length ? totalAno/doAno.length : 0;

  // Budget hero (mês atual)
  const mesKey = getMonthKey();
  const limite = orcamentoConfig.totalMensal||0;
  const gastoMesAtual = getGastoMes(mesKey);
  const pct = limite>0?Math.min((gastoMesAtual/limite)*100,100):0;
  const finAlerts = document.getElementById("fin-budget-alerts");
  if (finAlerts && limite>0) {
    finAlerts.innerHTML = `
      <div class="budget-hero">
        <div class="budget-hero-title">Orçamento Mensal — ${MESES[new Date().getMonth()]} ${new Date().getFullYear()}</div>
        <div class="budget-hero-amount">${fmtBRL(gastoMesAtual)}</div>
        <div class="budget-hero-sub">de ${fmtBRL(limite)} disponíveis</div>
        <div class="budget-hero-bar"><div class="budget-hero-fill ${getBudgetFillClass(pct)}" style="width:${pct}%"></div></div>
        <div class="budget-hero-legend"><span>${pct.toFixed(1)}% utilizado</span><span>Restante: ${fmtBRL(Math.max(0,limite-gastoMesAtual))}</span></div>
      </div>
      ${pct>=60?`<div class="alert-banner ${pct>=80?"":"warn"}" style="margin-bottom:16px">
        <div class="alert-banner-icon">${pct>=80?"🚨":"⚠️"}</div>
        <div><div class="alert-banner-title">${pct>=80?"CRÍTICO: 80% atingido!":"ATENÇÃO: 60% do orçamento utilizado"}</div>
        <div class="alert-banner-text">${pct.toFixed(1)}% do limite mensal utilizado — ${fmtBRL(Math.max(0,limite-gastoMesAtual))} restantes.</div></div>
      </div>`:""}`;
  } else if (finAlerts) finAlerts.innerHTML = "";

  document.getElementById("fin-kpis").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total ${ano}</div><div class="stat-value lumen" style="font-size:20px">${fmtBRL(totalAno)}</div><div class="stat-desc">${doAno.length} passagem(ns)</div></div>
    <div class="stat-card"><div class="stat-label">Ônibus</div><div class="stat-value" style="font-size:20px">${fmtBRL(totOnibus)}</div><div class="stat-desc">${doAno.filter(s=>s.tipo==="onibus").length} viagens</div></div>
    <div class="stat-card"><div class="stat-label">Avião</div><div class="stat-value" style="font-size:20px">${fmtBRL(totAviao)}</div><div class="stat-desc">${doAno.filter(s=>s.tipo==="aviao").length} viagens</div></div>
    <div class="stat-card"><div class="stat-label">Ticket Médio</div><div class="stat-value" style="font-size:20px">${fmtBRL(avgTicket)}</div><div class="stat-desc">Por passagem</div></div>
  `;

  const porMes = Array(12).fill(0);
  doAno.forEach(s=>{ porMes[new Date(s.dataCompra+"T00:00:00").getMonth()] += parseFloat(s.valorFinal)||0; });
  const finDs = [{ label:"Gasto (R$)", data:porMes, backgroundColor:"#2B9FA8", borderRadius:6 }];
  if (limite>0) finDs.push({ type:"line", label:"Limite", data:Array(12).fill(limite), borderColor:"#C0392B", borderDash:[6,4], borderWidth:2, pointRadius:0, fill:false });
  renderChart("chart-fin-mensal","bar",MESES,finDs);
  renderChart("chart-fin-tipo","doughnut",["Ônibus","Avião"],[{ data:[totOnibus,totAviao], backgroundColor:["#1565C0","#2E7D32"] }]);

  document.getElementById("fin-tbody").innerHTML = doAno.length
    ? doAno.map(s=>`<tr>
        <td><span class="ticket-code">${s.codigo||"—"}</span></td>
        <td>${esc(s.passageiro)}</td>
        <td><div class="route-display" style="font-size:12px">${esc(s.origem)}<span class="route-arrow">→</span>${esc(s.destino)}</div></td>
        <td><span class="type-icon type-${s.tipo}">${s.tipo==="aviao"?"✈️":"🚌"}</span></td>
        <td><span class="badge badge-info">${s.motivo}</span></td>
        <td>${esc(s.fornecedor||"—")}</td>
        <td><strong style="color:var(--ok)">${fmtBRL(s.valorFinal)}</strong></td>
        <td>${fmtDate(s.dataCompra)}</td>
      </tr>`).join("")
    : '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma passagem neste período</td></tr>';
}

// ─── ORÇAMENTO ────────────────────────────────────────────────────
function renderOrcamento() {
  const mesKey = orcamentoConfig.mesRef || getMonthKey();
  const limite = orcamentoConfig.totalMensal || 0;
  const gastoAtual = getGastoMes(mesKey);
  const pct = limite>0?Math.min((gastoAtual/limite)*100,100):0;

  // Preencher formulário
  const elTotal = document.getElementById("orc-total-mensal");
  const elMes   = document.getElementById("orc-mes-ref");
  if (elTotal) elTotal.value = orcamentoConfig.totalMensal||"";
  if (elMes)   elMes.value   = mesKey;

  // Alerta top
  const alertsDiv = document.getElementById("orc-alerts-top");
  if (alertsDiv) {
    if (limite > 0) {
      alertsDiv.innerHTML = `
        <div class="budget-hero" style="margin-bottom:18px">
          <div class="budget-hero-title">Orçamento — ${mesKey}</div>
          <div class="budget-hero-amount">${fmtBRL(gastoAtual)}</div>
          <div class="budget-hero-sub">gasto de ${fmtBRL(limite)} disponíveis</div>
          <div class="budget-hero-bar"><div class="budget-hero-fill ${getBudgetFillClass(pct)}" style="width:${pct}%"></div></div>
          <div class="budget-hero-legend"><span>${pct.toFixed(1)}% utilizado</span><span>Restante: ${fmtBRL(Math.max(0,limite-gastoAtual))}</span></div>
        </div>
        ${pct>=80?`<div class="alert-banner" style="margin-bottom:16px"><div class="alert-banner-icon">🚨</div><div><div class="alert-banner-title">CRÍTICO: ${pct.toFixed(1)}% do orçamento mensal utilizado!</div><div class="alert-banner-text">Recomendamos suspender novas compras até o próximo mês.</div></div></div>`:""}
        ${pct>=60&&pct<80?`<div class="alert-banner warn" style="margin-bottom:16px"><div class="alert-banner-icon">⚠️</div><div><div class="alert-banner-title">ALERTA: 60% do orçamento atingido (${pct.toFixed(1)}%)</div><div class="alert-banner-text">Avalie com cuidado as próximas compras. Restam ${fmtBRL(Math.max(0,limite-gastoAtual))}.</div></div></div>`:""}
        ${pct<60?`<div class="alert-banner ok" style="margin-bottom:16px"><div class="alert-banner-icon">✅</div><div><div class="alert-banner-title">Orçamento sob controle — ${pct.toFixed(1)}% utilizado</div><div class="alert-banner-text">${fmtBRL(Math.max(0,limite-gastoAtual))} disponíveis até o final do mês.</div></div></div>`:""}`;
    } else {
      alertsDiv.innerHTML = `<div class="alert-banner info" style="margin-bottom:16px"><div class="alert-banner-icon">💡</div><div><div class="alert-banner-title">Configure um orçamento mensal</div><div class="alert-banner-text">Defina um limite para receber alertas automáticos ao atingir 60% e 80%.</div></div></div>`;
    }
  }

  // Preview do total
  const previewDiv = document.getElementById("orc-total-preview");
  if (previewDiv && limite>0) {
    previewDiv.innerHTML = `
      <div class="budget-bar-wrap">
        <div class="budget-bar-label"><span>Utilizado: ${fmtBRL(gastoAtual)}</span><span>${pct.toFixed(1)}%</span></div>
        <div class="budget-bar"><div class="budget-bar-fill ${getBudgetFillClass(pct)}" style="width:${pct}%"></div></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Disponível: ${fmtBRL(Math.max(0,limite-gastoAtual))}</div>
      </div>`;
  } else if (previewDiv) previewDiv.innerHTML = "";

  // Fornecedores budget
  const listDiv = document.getElementById("fornecedor-budget-list");
  if (listDiv) {
    if (!allFornecedores.filter(f=>f.ativo!==false).length) {
      listDiv.innerHTML = `<div style="color:var(--text-muted);font-size:13px">Nenhum fornecedor ativo. <a onclick="goPage('fornecedores')" style="color:var(--lumen);cursor:pointer">Cadastrar →</a></div>`;
    } else {
      const fornBudgets = orcamentoConfig.fornBudgets || {};
      listDiv.innerHTML = `<div class="supplier-budget-grid">` +
        allFornecedores.filter(f=>f.ativo!==false).map(f => {
          const cfg = fornBudgets[f.id]||{};
          const gF  = getGastoMesPorFornecedor(mesKey, f.nome);
          const lF  = cfg.limite||0;
          const pF  = lF>0?Math.min((gF/lF)*100,100):0;
          const alertClass = pF>=80?"alert-80":pF>=60?"alert-60":"";
          return `<div class="supplier-budget-card ${alertClass}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div class="supplier-name">${esc(f.nome)} ${pF>=60?`<span class="badge ${pF>=80?"badge-danger":"badge-warn"}">${pF>=80?"🚨 CRÍTICO":"⚠️ ALERTA"}</span>`:""}</div>
                <div class="supplier-meta"><span class="type-icon type-${f.tipo==="ambos"?"onibus":f.tipo}" style="font-size:10px">${f.tipo==="aviao"?"✈️":"🚌"}</span></div>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:8px">
              <label class="form-label" style="font-size:10px">Limite mensal (R$)</label>
              <input class="form-input" id="budget-forn-${f.id}" type="number" step="100" value="${lF||""}" placeholder="Sem limite" style="padding:8px">
            </div>
            ${lF>0?`<div class="budget-bar-wrap"><div class="budget-bar-label"><span>Gasto: ${fmtBRL(gF)}</span><span>${pF.toFixed(0)}%</span></div><div class="budget-bar"><div class="budget-bar-fill ${getBudgetFillClass(pF)}" style="width:${pF}%"></div></div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">Restante: ${fmtBRL(Math.max(0,lF-gF))}</div></div>`
            :`<div style="font-size:12px;color:var(--text-muted)">Gasto este mês: <strong>${fmtBRL(gF)}</strong></div>`}
          </div>`;
        }).join("") + "</div>";
    }
  }

  // Gráficos
  const ano = new Date().getFullYear();
  const compradasAno = allSolicitacoes.filter(s=>["comprada","concluida"].includes(s.status)&&s.valorFinal&&s.dataCompra&&new Date(s.dataCompra+"T00:00:00").getFullYear()===ano);
  const porMesH = Array(12).fill(0);
  compradasAno.forEach(s=>{porMesH[new Date(s.dataCompra+"T00:00:00").getMonth()]+=parseFloat(s.valorFinal)||0;});
  const dsH = [{ label:"Gasto (R$)", data:porMesH, backgroundColor:"#2B9FA8", borderRadius:6 }];
  if (limite>0) {
    dsH.push({ type:"line", label:"Limite", data:Array(12).fill(limite), borderColor:"#C0392B", borderDash:[5,5], borderWidth:2, pointRadius:0, fill:false });
    dsH.push({ type:"line", label:"60% Limite", data:Array(12).fill(limite*0.6), borderColor:"#D4890A", borderDash:[3,3], borderWidth:1.5, pointRadius:0, fill:false });
  }
  renderChart("chart-orc-historico","bar",MESES,dsH);

  const fornBudgets2 = orcamentoConfig.fornBudgets||{};
  const fNames=[],fGastos=[],fLimites=[];
  allFornecedores.filter(f=>f.ativo!==false).forEach(f=>{
    const g=getGastoMesPorFornecedor(mesKey,f.nome);
    const l=(fornBudgets2[f.id]?.limite)||0;
    if (g>0||l>0) { fNames.push(f.nome); fGastos.push(g); fLimites.push(l); }
  });
  const dsF=[{ label:"Gasto", data:fGastos, backgroundColor:"#2B9FA8", borderRadius:4 }];
  if (fLimites.some(l=>l>0)) dsF.push({ label:"Limite", data:fLimites, backgroundColor:"rgba(192,57,43,0.2)", borderColor:"#C0392B", borderWidth:2, borderRadius:4, type:"bar" });
  renderChart("chart-orc-fornecedor","bar",fNames,dsF,{indexAxis:"y"});
}

async function saveOrcamentoConfig() {
  const totalMensal = parseFloat(document.getElementById("orc-total-mensal").value)||0;
  const mesRef = document.getElementById("orc-mes-ref").value || getMonthKey();
  const fornBudgets = {};
  allFornecedores.forEach(f => {
    const el = document.getElementById(`budget-forn-${f.id}`);
    if (el && el.value) fornBudgets[f.id] = { nome:f.nome, limite:parseFloat(el.value)||0 };
  });
  orcamentoConfig = { totalMensal, mesRef, fornBudgets, updatedAt:new Date().toISOString() };
  await db.collection("configuracoes").doc("orcamento").set(orcamentoConfig);
  toast("Orçamento salvo com sucesso!","success");
  renderOrcamento();
  checkBudgetAlerts();
}

// ─── INDICADORES ──────────────────────────────────────────────────
function renderIndicadores() {
  const ano = parseInt(document.getElementById("ind-filter-ano")?.value||new Date().getFullYear());
  const compradas = allSolicitacoes.filter(s=>["comprada","concluida"].includes(s.status)&&s.valorFinal&&s.dataCompra);
  const doAno = compradas.filter(s=>new Date(s.dataCompra+"T00:00:00").getFullYear()===ano);
  const total = doAno.reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);
  const aprovadas = allSolicitacoes.filter(s=>["aprovada","comprada","concluida"].includes(s.status)).length;
  const taxa = allSolicitacoes.length?(aprovadas/allSolicitacoes.length*100).toFixed(1):0;
  const antecs = doAno.map(s=>{const c=new Date(s.dataCompra+"T00:00:00");const d=new Date(s.saida+"T00:00:00");return Math.max(0,Math.ceil((d-c)/86400000));});
  const avgAntec = antecs.length?(antecs.reduce((a,b)=>a+b,0)/antecs.length).toFixed(1):"—";
  const economia = doAno.reduce((acc,s)=>{const med=calcMediaHistorica(s.origem,s.destino);return acc+(med>0?med-parseFloat(s.valorFinal):0);},0);

  document.getElementById("ind-kpis").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total ${ano}</div><div class="stat-value lumen" style="font-size:20px">${fmtBRL(total)}</div><div class="stat-desc">${doAno.length} passagens</div></div>
    <div class="stat-card"><div class="stat-label">Taxa Aprovação</div><div class="stat-value ok">${taxa}%</div></div>
    <div class="stat-card"><div class="stat-label">Antecedência Média</div><div class="stat-value warn">${avgAntec} dias</div></div>
    <div class="stat-card"><div class="stat-label">Economia Acumulada</div><div class="stat-value ${economia>=0?"ok":"danger"}" style="font-size:20px">${fmtBRL(Math.abs(economia))}</div><div class="stat-desc">${economia>=0?"Abaixo":"Acima"} da média</div></div>
  `;

  const porMotivo={};
  doAno.forEach(s=>{porMotivo[s.motivo]=(porMotivo[s.motivo]||0)+(parseFloat(s.valorFinal)||0);});
  renderChart("chart-motivo","doughnut",Object.keys(porMotivo),[{data:Object.values(porMotivo),backgroundColor:CORES_CHART}]);

  const porForn={};
  doAno.forEach(s=>{if(s.fornecedor)porForn[s.fornecedor]=(porForn[s.fornecedor]||0)+(parseFloat(s.valorFinal)||0);});
  const fE=Object.entries(porForn).sort((a,b)=>b[1]-a[1]).slice(0,8);
  renderChart("chart-fornecedor","bar",fE.map(e=>e[0]),[{label:"Gasto (R$)",data:fE.map(e=>e[1]),backgroundColor:CORES_CHART,borderRadius:4}],{indexAxis:"y"});

  const porTrajeto={};
  doAno.forEach(s=>{const k=`${s.origem} → ${s.destino}`;porTrajeto[k]=(porTrajeto[k]||0)+(parseFloat(s.valorFinal)||0);});
  const tE=Object.entries(porTrajeto).sort((a,b)=>b[1]-a[1]).slice(0,8);
  renderChart("chart-trajetos","bar",tE.map(e=>e[0]),[{label:"Gasto (R$)",data:tE.map(e=>e[1]),backgroundColor:"#1D7A82",borderRadius:4}],{indexAxis:"y"});

  const porPass={};
  doAno.forEach(s=>{porPass[s.passageiro]=(porPass[s.passageiro]||0)+(parseFloat(s.valorFinal)||0);});
  const pE=Object.entries(porPass).sort((a,b)=>b[1]-a[1]).slice(0,8);
  renderChart("chart-passageiros","bar",pE.map(e=>e[0]),[{label:"Gasto (R$)",data:pE.map(e=>e[1]),backgroundColor:"#6C3483",borderRadius:4}],{indexAxis:"y"});

  const antecPM=Array(12).fill(0); const cntPM=Array(12).fill(0);
  doAno.forEach(s=>{const m=new Date(s.dataCompra+"T00:00:00").getMonth();const d=Math.max(0,Math.ceil((new Date(s.saida+"T00:00:00")-new Date(s.dataCompra+"T00:00:00"))/86400000));antecPM[m]+=d;cntPM[m]++;});
  renderChart("chart-antecedencia","line",MESES,[{label:"Dias",data:antecPM.map((a,i)=>cntPM[i]?+(a/cntPM[i]).toFixed(1):0),borderColor:"#D4890A",backgroundColor:"rgba(212,136,10,0.1)",tension:0.3,fill:true}]);

  const econPM=Array(12).fill(0);
  doAno.forEach(s=>{const med=calcMediaHistorica(s.origem,s.destino);if(med>0){const m=new Date(s.dataCompra+"T00:00:00").getMonth();econPM[m]+=(med-parseFloat(s.valorFinal));}});
  renderChart("chart-economia","bar",MESES,[{label:"Economia (R$)",data:econPM,backgroundColor:econPM.map(v=>v>=0?"#1A7A44":"#C0392B"),borderRadius:4}]);
}

// ─── CALENDÁRIO ───────────────────────────────────────────────────
function renderCalendario() {
  const monthNames=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  document.getElementById("cal-title").textContent=`${monthNames[calMonth]} ${calYear}`;
  document.getElementById("cal-headers").innerHTML=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(h=>`<div class="cal-day-header">${h}</div>`).join("");
  const first=new Date(calYear,calMonth,1); const last=new Date(calYear,calMonth+1,0);
  const today=new Date(); today.setHours(0,0,0,0);
  const doMes=allSolicitacoes.filter(s=>{
    if(!s.saida) return false;
    const d=new Date(s.saida+"T00:00:00");
    return d.getFullYear()===calYear&&d.getMonth()===calMonth&&!["reprovada"].includes(s.status);
  });
  let cells="";
  for(let i=0;i<first.getDay();i++) cells+=`<div class="cal-cell other-month"></div>`;
  for(let d=1;d<=last.getDate();d++) {
    const dt=new Date(calYear,calMonth,d);
    const isToday=dt.getTime()===today.getTime();
    const events=doMes.filter(s=>new Date(s.saida+"T00:00:00").getDate()===d);
    cells+=`<div class="cal-cell ${isToday?"today":""}">
      <div class="cal-date-num">${d}</div>
      ${events.map(e=>`<div class="cal-event ${e.tipo}" onclick="openDetalhes('${e.id}')" title="${esc(e.passageiro)}">${e.tipo==="aviao"?"✈":"🚌"} ${esc(e.passageiro.split(" ")[0])}</div>`).join("")}
    </div>`;
  }
  document.getElementById("cal-body").innerHTML=cells;
  const sorted=doMes.sort((a,b)=>a.saida.localeCompare(b.saida));
  document.getElementById("cal-tbody").innerHTML=sorted.length
    ?sorted.map(s=>`<tr>
        <td><strong>${fmtDate(s.saida)}</strong></td>
        <td>${esc(s.passageiro)}</td>
        <td><div class="route-display" style="font-size:12px">${esc(s.origem)}<span class="route-arrow">→</span>${esc(s.destino)}</div></td>
        <td><span class="type-icon type-${s.tipo}">${s.tipo==="aviao"?"✈️":"🚌"}</span></td>
        <td><span class="badge status-${s.status}">${STATUS_LABELS[s.status]}</span></td>
        <td>${s.retorno?fmtDate(s.retorno):"—"}</td>
      </tr>`).join("")
    :"<tr><td colspan='6' style='text-align:center;padding:32px;color:var(--text-muted)'>Nenhuma viagem neste mês</td></tr>";
}

function calNav(dir) {
  calMonth+=dir;
  if(calMonth<0){calMonth=11;calYear--;} if(calMonth>11){calMonth=0;calYear++;}
  renderCalendario();
}

// ─── USUÁRIOS ─────────────────────────────────────────────────────
async function renderUsuarios() {
  const snap=await db.collection("users").get();
  allUsers=snap.docs.map(d=>({id:d.id,...d.data()}));
  const pendentes=allUsers.filter(u=>!u.approved);
  const ativos=allUsers.filter(u=>u.approved);
  document.getElementById("card-pendentes").style.display=pendentes.length?"":"none";
  document.getElementById("usuarios-pendentes-tbody").innerHTML=pendentes.map(u=>`<tr>
    <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${fmtDateTime(u.createdAt)}</td>
    <td style="display:flex;gap:6px"><button class="btn btn-ok btn-sm" onclick="approveUser('${u.id}')">✓ Aprovar</button><button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')">✕ Rejeitar</button></td>
  </tr>`).join("");
  document.getElementById("usuarios-ativos-tbody").innerHTML=ativos.map(u=>`<tr>
    <td>${esc(u.name)} ${u.id===currentUser.uid?"<span style='font-size:10px;color:var(--text-muted)'>(você)</span>":""}</td>
    <td>${esc(u.email)}</td>
    <td><span class="badge ${u.role==="admin"?"badge-info":"badge-gray"}">${u.role==="admin"?"Admin":"Usuário"}</span></td>
    <td>${fmtDateTime(u.createdAt)}</td>
    <td>${u.id!==currentUser.uid?`<button class="btn btn-secondary btn-sm" onclick="toggleRole('${u.id}','${u.role}')">${u.role==="admin"?"→ Usuário":"→ Admin"}</button>`:"—"}</td>
  </tr>`).join("");
}

async function approveUser(uid) { await db.collection("users").doc(uid).update({approved:true}); toast("Usuário aprovado!","success"); renderUsuarios(); }
async function rejectUser(uid)  { if(!confirm("Rejeitar?")) return; await db.collection("users").doc(uid).delete(); toast("Rejeitado.","warn"); renderUsuarios(); }
async function toggleRole(uid,curRole) {
  const newRole=curRole==="admin"?"user":"admin";
  await db.collection("users").doc(uid).update({role:newRole});
  toast(`Função: ${newRole==="admin"?"Admin":"Usuário"}!`,"success"); renderUsuarios();
}
