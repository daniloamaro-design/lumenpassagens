/* ═══════════════════════════════════════════════════════════════
   LUMEN PASSAGENS — gemini.js
   Assistente IA com Google Gemini
   ═══════════════════════════════════════════════════════════════ */

let aiChatHistory = [];
let aiIsLoading   = false;

// ─── TOGGLE PAINEL ────────────────────────────────────────────────
function toggleAI() {
  document.body.classList.toggle("ai-open");
  if (document.body.classList.contains("ai-open") && aiChatHistory.length === 0) {
    initAIChat();
  }
}

// ─── INICIALIZAR CHAT ─────────────────────────────────────────────
function initAIChat() {
  const msgs = document.getElementById("ai-msgs");
  msgs.innerHTML = "";
  aiChatHistory = [];
  const nome = currentUser?.name?.split(" ")[0] || "usuário";
  addAIMessage("bot",
    `Olá, ${nome}! 👋 Sou o **Assistente Gemini** integrado ao Lumen Passagens.\n\nTenho acesso em tempo real a todos os dados do sistema. Posso te ajudar com:\n\n📊 Análise de gastos e orçamento\n✈️ Status e acompanhamento de viagens\n⚠️ Alertas e prioridades\n💡 Insights e recomendações\n📅 Calendário e planejamento\n\nO que deseja saber?`
  );
}

// ─── MENSAGEM RÁPIDA (chamada de fora) ───────────────────────────
async function askAI(prompt) {
  if (!document.body.classList.contains("ai-open")) toggleAI();
  if (aiChatHistory.length === 0) initAIChat();
  const input = document.getElementById("ai-input");
  input.value = prompt;
  await sendAIMessage();
}

// ─── ENVIAR MENSAGEM ─────────────────────────────────────────────
async function sendAIMessage() {
  if (aiIsLoading) return;
  const input = document.getElementById("ai-input");
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";

  addAIMessage("user", text);
  aiChatHistory.push({ role:"user", parts:[{ text }] });

  aiIsLoading = true;
  const loadingEl = addLoadingMessage();

  try {
    const systemCtx = buildSystemContext();

    // Gemini usa formato diferente do OpenAI:
    // - history no array "contents"
    // - system instruction separada
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemCtx }] },
          contents: aiChatHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    const data = await response.json();
    loadingEl.remove();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const reply = data.candidates[0].content.parts[0].text;
      aiChatHistory.push({ role:"model", parts:[{ text: reply }] });
      addAIMessage("bot", reply);
    } else if (data.error) {
      addAIMessage("bot", `❌ Erro da API Gemini: ${data.error.message || "Verifique sua API key."}`);
    } else {
      addAIMessage("bot", "⚠️ Não foi possível obter resposta. Verifique a chave Gemini em js/config.js.");
    }
  } catch(err) {
    loadingEl.remove();
    addAIMessage("bot", "❌ Falha na conexão com o Gemini. Verifique sua chave e conexão.");
    console.error("Gemini Error:", err);
  } finally {
    aiIsLoading = false;
  }
}

// ─── CONTEXTO DO SISTEMA (dados reais injetados) ──────────────────
function buildSystemContext() {
  const hoje  = new Date();
  const mes   = hoje.getMonth();
  const ano   = hoje.getFullYear();
  const mesKey = getMonthKey();

  const compradas = allSolicitacoes.filter(s =>
    ["comprada","concluida"].includes(s.status) && s.valorFinal
  );
  const gastoMes = compradas.filter(s => {
    const d = s.dataCompra ? new Date(s.dataCompra+"T00:00:00") : null;
    return d && d.getMonth()===mes && d.getFullYear()===ano;
  }).reduce((a,s) => a+(parseFloat(s.valorFinal)||0), 0);

  const limite    = orcamentoConfig.totalMensal || 0;
  const pendentes = allSolicitacoes.filter(s => s.status==="pendente");
  const aprovadas = allSolicitacoes.filter(s => s.status==="aprovada");
  const hoje0     = new Date(); hoje0.setHours(0,0,0,0);

  const urgentes = aprovadas.filter(s => {
    const saida = new Date(s.saida+"T00:00:00");
    const diff  = Math.ceil((saida - hoje0) / 86400000);
    return diff >= 0 && diff <= 7;
  });

  const totalGasto = compradas.reduce((a,s) => a+(parseFloat(s.valorFinal)||0), 0);

  // Top fornecedores do mês
  const porForn = {};
  compradas.filter(s => {
    const d = s.dataCompra ? new Date(s.dataCompra+"T00:00:00") : null;
    return d && d.getMonth()===mes && d.getFullYear()===ano;
  }).forEach(s => {
    if (s.fornecedor) porForn[s.fornecedor] = (porForn[s.fornecedor]||0) + (parseFloat(s.valorFinal)||0);
  });
  const topForn = Object.entries(porForn).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,v])=>`${n}: ${fmtBRL(v)}`).join(", ");

  return `Você é o Assistente Gemini do sistema Lumen Passagens, especializado em gestão de viagens corporativas. 
Responda SEMPRE em português brasileiro. Seja profissional, direto e use emojis com moderação.
Para análises, forneça insights acionáveis e objetivos.

═══ DADOS DO SISTEMA (${hoje.toLocaleDateString("pt-BR")}) ═══

SOLICITAÇÕES:
- Total: ${allSolicitacoes.length}
- Pendentes de aprovação: ${pendentes.length}${pendentes.length>0?" → "+pendentes.slice(0,5).map(s=>s.passageiro).join(", "):""}
- Aprovadas aguardando compra: ${aprovadas.length}
- URGENTES (viagem ≤7 dias sem passagem): ${urgentes.length}${urgentes.length>0?" → "+urgentes.map(s=>s.passageiro+" em "+fmtDate(s.saida)).join(", "):""}

FINANCEIRO:
- Gasto este mês (${MESES[mes]}/${ano}): ${fmtBRL(gastoMes)}
- Orçamento mensal definido: ${limite>0?fmtBRL(limite):"Não configurado"}
- % do orçamento utilizado: ${limite>0?((gastoMes/limite)*100).toFixed(1)+"%":"—"}
- Gasto total histórico: ${fmtBRL(totalGasto)}
- Top fornecedores do mês: ${topForn||"Nenhum dado"}

FORNECEDORES ATIVOS: ${allFornecedores.filter(f=>f.ativo!==false).map(f=>f.nome).join(", ")||"Nenhum"}

ÚLTIMAS 10 SOLICITAÇÕES:
${allSolicitacoes.slice(0,10).map(s =>
  `- ${s.codigo||"N/A"}: ${s.passageiro} | ${s.origem}→${s.destino} | ${s.tipo} | ${STATUS_LABELS[s.status]}${s.valorFinal?" | "+fmtBRL(s.valorFinal):""} | saída: ${fmtDate(s.saida)}`
).join("\n")}

USUÁRIO ATUAL: ${currentUser?.name} (${currentRole==="admin"?"Administrador":"Usuário comum"})
═══════════════════════════════════════════`;
}

// ─── UI HELPERS ───────────────────────────────────────────────────
function addAIMessage(role, text) {
  const msgs = document.getElementById("ai-msgs");
  const div  = document.createElement("div");
  div.className = `ai-msg ${role==="user"?"user":""}`;

  const avatar = document.createElement("div");
  avatar.className = role==="user" ? "ai-avatar-user" : "ai-avatar-bot";
  avatar.textContent = role==="user"
    ? (currentUser?.name?.charAt(0).toUpperCase()||"U")
    : "G";

  const bubble = document.createElement("div");
  bubble.className = role==="user" ? "ai-bubble-user" : "ai-bubble-bot";
  // Formatar markdown simples
  bubble.innerHTML = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  div.appendChild(avatar);
  div.appendChild(bubble);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function addLoadingMessage() {
  const msgs = document.getElementById("ai-msgs");
  const div  = document.createElement("div");
  div.className = "ai-msg";
  div.innerHTML = `
    <div class="ai-avatar-bot">G</div>
    <div class="ai-bubble-bot ai-loading">
      <div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function handleAIKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAIMessage();
  }
}
