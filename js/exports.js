/* ═══════════════════════════════════════════════════════════════
   LUMEN PASSAGENS — exports.js
   Exportação: PDF (jsPDF), Excel (XLSX), CSV
   ═══════════════════════════════════════════════════════════════ */

// ─── EXCEL ────────────────────────────────────────────────────────
function exportSolicitacoesExcel() {
  const rows = allSolicitacoes.map(s => ({
    Código:        s.codigo||"",
    Solicitante:   s.solicitante,
    Passageiro:    s.passageiro,
    Origem:        s.origem,
    Destino:       s.destino,
    Tipo:          s.tipo==="aviao"?"Avião":"Ônibus",
    Motivo:        s.motivo,
    "Data Saída":  s.saida,
    "Data Retorno":s.retorno||"",
    Turno:         s.turno,
    Bagagem:       s.bagagem==="sim"?"Sim":"Não",
    Status:        STATUS_LABELS[s.status]||s.status,
    Fornecedor:    s.fornecedor||"",
    "Valor (R$)":  s.valorFinal||"",
    "Data Compra": s.dataCompra||""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Solicitações");
  XLSX.writeFile(wb, "lumen-passagens.xlsx");
  toast("Excel gerado!","success");
}

function exportFinanceiroExcel() {
  const ano = parseInt(document.getElementById("fin-filter-ano")?.value||new Date().getFullYear());
  const rows = allSolicitacoes
    .filter(s => ["comprada","concluida"].includes(s.status) && s.valorFinal && s.dataCompra && new Date(s.dataCompra+"T00:00:00").getFullYear()===ano)
    .map(s => ({
      Código:       s.codigo||"",
      Passageiro:   s.passageiro,
      Origem:       s.origem,
      Destino:      s.destino,
      Tipo:         s.tipo==="aviao"?"Avião":"Ônibus",
      Motivo:       s.motivo,
      Fornecedor:   s.fornecedor||"",
      "Valor (R$)": parseFloat(s.valorFinal),
      "Data Compra":s.dataCompra
    }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Financeiro ${ano}`);
  XLSX.writeFile(wb, `lumen-financeiro-${ano}.xlsx`);
  toast("Excel gerado!","success");
}

// ─── CSV ──────────────────────────────────────────────────────────
function exportSolicitacoesCSV() {
  const headers = ["Código","Passageiro","Origem","Destino","Tipo","Motivo","Data Saída","Status","Valor"];
  const rows = allSolicitacoes.map(s => [
    s.codigo||"", s.passageiro, s.origem, s.destino,
    s.tipo==="aviao"?"Avião":"Ônibus", s.motivo,
    s.saida, STATUS_LABELS[s.status]||s.status, s.valorFinal||""
  ]);
  downloadCSV([headers,...rows], "lumen-passagens.csv");
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a   = document.createElement("a");
  a.href    = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
  a.download = filename;
  a.click();
  toast("CSV gerado!","success");
}

// ─── PDF HELPERS ──────────────────────────────────────────────────
function pdfHeader(doc, title, subtitle="") {
  // Cabeçalho verde teal
  doc.setFillColor(43,159,168);
  doc.rect(0,0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(13);
  doc.setFont(undefined,"bold");
  doc.text("LUMEN PASSAGENS", 14, 10);
  doc.setFontSize(10);
  doc.setFont(undefined,"normal");
  doc.text(title, 14, 17);
  if (subtitle) {
    doc.setFontSize(8);
    doc.text(subtitle, doc.internal.pageSize.getWidth()-14, 17, { align:"right" });
  }
  doc.setTextColor(26,43,44);
  return 30;
}

function pdfFooter(doc) {
  const pg  = doc.internal.getNumberOfPages();
  const w   = doc.internal.pageSize.getWidth();
  const h   = doc.internal.pageSize.getHeight();
  for (let i=1; i<=pg; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pg}`, w-14, h-8, { align:"right" });
    doc.text(`Lumen Passagens · ${new Date().toLocaleDateString("pt-BR")}`, 14, h-8);
    doc.setDrawColor(43,159,168);
    doc.setLineWidth(0.5);
    doc.line(14, h-12, w-14, h-12);
  }
}

// ─── PDF SOLICITAÇÕES ─────────────────────────────────────────────
function exportSolicitacoesPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"landscape" });
  const startY = pdfHeader(doc, "Todas as Solicitações", `Gerado em ${new Date().toLocaleString("pt-BR")}`);
  doc.autoTable({
    startY,
    head: [["Código","Passageiro","Trajeto","Tipo","Motivo","Data Saída","Valor","Status"]],
    body: allSolicitacoes.map(s=>[
      s.codigo||"", s.passageiro,
      `${s.origem} → ${s.destino}`,
      s.tipo==="aviao"?"Avião":"Ônibus",
      s.motivo, fmtDate(s.saida),
      s.valorFinal?fmtBRL(s.valorFinal):"—",
      STATUS_LABELS[s.status]||s.status
    ]),
    headStyles:      { fillColor:[43,159,168], textColor:255, fontSize:9, fontStyle:"bold" },
    alternateRowStyles: { fillColor:[230,246,247] },
    styles:          { fontSize:9, cellPadding:4 },
    columnStyles:    { 6:{halign:"right"} }
  });
  pdfFooter(doc);
  doc.save("lumen-solicitacoes.pdf");
  toast("PDF gerado!","success");
}

// ─── PDF FINANCEIRO ───────────────────────────────────────────────
function exportFinanceiroPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"landscape" });
  const ano = parseInt(document.getElementById("fin-filter-ano")?.value||new Date().getFullYear());
  const startY = pdfHeader(doc, `Controle Financeiro ${ano}`, `Gerado em ${new Date().toLocaleString("pt-BR")}`);
  const rows = allSolicitacoes.filter(s =>
    ["comprada","concluida"].includes(s.status) && s.valorFinal && s.dataCompra &&
    new Date(s.dataCompra+"T00:00:00").getFullYear() === ano
  );
  const total = rows.reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);

  // KPIs
  doc.setFontSize(10);
  doc.setFont(undefined,"bold");
  doc.text(`Total ${ano}: ${fmtBRL(total)}`, 14, startY);
  doc.text(`Passagens: ${rows.length}`, 80, startY);
  doc.setFont(undefined,"normal");

  doc.autoTable({
    startY: startY+8,
    head: [["Código","Passageiro","Trajeto","Tipo","Motivo","Fornecedor","Valor","Data Compra"]],
    body: rows.map(s=>[
      s.codigo||"", s.passageiro,
      `${s.origem} → ${s.destino}`,
      s.tipo==="aviao"?"Avião":"Ônibus",
      s.motivo, s.fornecedor||"—",
      fmtBRL(s.valorFinal), fmtDate(s.dataCompra)
    ]),
    foot: [["","","","","","Total",fmtBRL(total),""]],
    headStyles: { fillColor:[43,159,168], textColor:255, fontSize:9, fontStyle:"bold" },
    footStyles: { fillColor:[26,122,68],  textColor:255, fontStyle:"bold" },
    alternateRowStyles: { fillColor:[230,246,247] },
    styles: { fontSize:9, cellPadding:4 },
    columnStyles: { 6:{halign:"right"} }
  });
  pdfFooter(doc);
  doc.save(`lumen-financeiro-${ano}.pdf`);
  toast("PDF gerado!","success");
}

// ─── PDF DASHBOARD ────────────────────────────────────────────────
function exportDashboardPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const startY = pdfHeader(doc, "Dashboard — Resumo Executivo", new Date().toLocaleString("pt-BR"));
  const compradas = allSolicitacoes.filter(s=>["comprada","concluida"].includes(s.status)&&s.valorFinal);
  const total     = compradas.reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);
  const pendentes = allSolicitacoes.filter(s=>s.status==="pendente").length;
  const mes = new Date().getMonth(); const ano = new Date().getFullYear();
  const gastoMes  = compradas.filter(s=>{const d=s.dataCompra?new Date(s.dataCompra+"T00:00:00"):null;return d&&d.getMonth()===mes&&d.getFullYear()===ano;}).reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);
  doc.autoTable({
    startY,
    body: [
      ["Total de Solicitações", allSolicitacoes.length],
      ["Pendentes de Aprovação", pendentes],
      ["Aprovadas (aguardando compra)", allSolicitacoes.filter(s=>s.status==="aprovada").length],
      ["Gasto este Mês",   fmtBRL(gastoMes)],
      ["Gasto Total Histórico", fmtBRL(total)],
      ["Orçamento Mensal", orcamentoConfig.totalMensal?fmtBRL(orcamentoConfig.totalMensal):"Não configurado"]
    ],
    styles: { fontSize:11, cellPadding:5 },
    columnStyles: { 0:{fontStyle:"bold", cellWidth:80}, 1:{halign:"right"} }
  });
  pdfFooter(doc);
  doc.save("lumen-dashboard.pdf");
  toast("PDF gerado!","success");
}

// ─── PDF SOLICITAÇÃO INDIVIDUAL ───────────────────────────────────
function exportSolicitacaoPDF(id) {
  const s = allSolicitacoes.find(x=>x.id===id);
  if (!s) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const startY = pdfHeader(doc, `Solicitação — ${s.codigo||"—"}`, `Emitido em ${new Date().toLocaleString("pt-BR")}`);
  const rows = [
    ["Código",         s.codigo||"—"],
    ["Passageiro",     s.passageiro],
    ["Solicitante",    s.solicitante],
    ["Tipo",           s.tipo==="aviao"?"Avião":"Ônibus"],
    ["Motivo",         s.motivo],
    ["Origem",         s.origem],
    ["Destino",        s.destino],
    ["Data de Saída",  fmtDate(s.saida)],
    ["Data de Retorno",s.retorno?fmtDate(s.retorno):"—"],
    ["Turno",          s.turno],
    ["Bagagem",        s.bagagem==="sim"?"Sim":"Não"],
    ["Status",         STATUS_LABELS[s.status]||s.status],
    ...(s.valorFinal ? [
      ["Valor Pago",   fmtBRL(s.valorFinal)],
      ["Fornecedor",   s.fornecedor||"—"],
      ["Data Compra",  fmtDate(s.dataCompra)]
    ] : []),
    ...(s.obs ? [["Observações", s.obs]] : [])
  ];
  doc.autoTable({
    startY,
    body: rows,
    styles:       { fontSize:10, cellPadding:5 },
    columnStyles: { 0:{fontStyle:"bold", cellWidth:52}, 1:{} }
  });
  pdfFooter(doc);
  doc.save(`passagem-${s.codigo||s.id}.pdf`);
  toast("PDF gerado!","success");
}

// ─── PDF INDICADORES ─────────────────────────────────────────────
function exportIndicadoresPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const ano = parseInt(document.getElementById("ind-filter-ano")?.value||new Date().getFullYear());
  const startY = pdfHeader(doc, `Indicadores ${ano}`, `Gerado em ${new Date().toLocaleString("pt-BR")}`);
  const compradas = allSolicitacoes.filter(s=>["comprada","concluida"].includes(s.status)&&s.valorFinal&&s.dataCompra&&new Date(s.dataCompra+"T00:00:00").getFullYear()===ano);
  const total = compradas.reduce((a,s)=>a+(parseFloat(s.valorFinal)||0),0);
  const porMotivo = {};
  compradas.forEach(s=>{porMotivo[s.motivo]=(porMotivo[s.motivo]||0)+(parseFloat(s.valorFinal)||0);});
  doc.autoTable({
    startY,
    head: [["Motivo","Total Gasto","% do Total"]],
    body: Object.entries(porMotivo).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k, fmtBRL(v), total?((v/total)*100).toFixed(1)+"%":"0%"]),
    headStyles: { fillColor:[43,159,168], textColor:255, fontSize:9, fontStyle:"bold" },
    alternateRowStyles: { fillColor:[230,246,247] },
    styles: { fontSize:10, cellPadding:4 },
    columnStyles: { 1:{halign:"right"}, 2:{halign:"right"} }
  });
  pdfFooter(doc);
  doc.save(`lumen-indicadores-${ano}.pdf`);
  toast("PDF gerado!","success");
}

// ─── PDF CALENDÁRIO ───────────────────────────────────────────────
function exportCalendarioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"landscape" });
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const startY = pdfHeader(doc, `Calendário — ${meses[calMonth]} ${calYear}`, `Gerado em ${new Date().toLocaleString("pt-BR")}`);
  const doMes = allSolicitacoes.filter(s=>{
    if(!s.saida) return false;
    const d=new Date(s.saida+"T00:00:00");
    return d.getFullYear()===calYear&&d.getMonth()===calMonth&&!["reprovada"].includes(s.status);
  }).sort((a,b)=>a.saida.localeCompare(b.saida));
  doc.autoTable({
    startY,
    head: [["Data Saída","Passageiro","Origem","Destino","Tipo","Status","Retorno"]],
    body: doMes.map(s=>[fmtDate(s.saida), s.passageiro, s.origem, s.destino, s.tipo==="aviao"?"Avião":"Ônibus", STATUS_LABELS[s.status], s.retorno?fmtDate(s.retorno):"—"]),
    headStyles: { fillColor:[43,159,168], textColor:255, fontSize:9, fontStyle:"bold" },
    alternateRowStyles: { fillColor:[230,246,247] },
    styles: { fontSize:9, cellPadding:4 }
  });
  pdfFooter(doc);
  doc.save(`lumen-calendario-${calYear}-${String(calMonth+1).padStart(2,"0")}.pdf`);
  toast("PDF gerado!","success");
}
