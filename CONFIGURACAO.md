# 🚀 Guia de Configuração — Lumen Passagens (Multi-arquivo + Gemini AI)

## 📁 Estrutura dos Arquivos

```
lumen-passagens/
├── index.html          ← Página principal (HTML + estrutura)
├── css/
│   └── style.css       ← Todo o visual (layout Lumen Suprimentos)
└── js/
    ├── config.js       ← ⚠️  EDITE AQUI: Firebase + Gemini API keys
    ├── app.js          ← Estado global, auth, navegação, helpers
    ├── pages.js        ← Dashboard, financeiro, orçamento, indicadores...
    ├── forms.js        ← Nova solicitação, detalhes, fornecedores
    ├── exports.js      ← PDF, Excel, CSV
    └── gemini.js       ← Integração Gemini AI
```

---

## 🔑 Passo 1 — Obter a Chave do Gemini

1. Acesse **https://aistudio.google.com/apikey**
2. Faça login com sua conta Google
3. Clique em **"Create API key"** → selecione ou crie um projeto
4. Copie a chave gerada (começa com `AIzaSy...`)

---

## 🔥 Passo 2 — Criar o Projeto Firebase

1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"** → nome: `lumen-passagens`
3. Desative o Google Analytics (opcional) → **Criar projeto**

### Ativar Authentication
- Painel → **Authentication → Começar**
- Aba **Método de login** → Ative **E-mail/Senha** → Salvar

### Criar Firestore
- **Firestore Database → Criar banco de dados**
- Escolha **Modo de produção**
- Região: **southamerica-east1 (São Paulo)** → Ativar

### Regras de Segurança
Vá em **Firestore → Regras** e cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, update: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /passagens_solicitacoes/{docId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true;
    }

    match /passagens_fornecedores/{docId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /configuracoes/{docId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

Clique em **Publicar**.

### Obter credenciais do Firebase
- Painel → ícone **`</>`** (Web) → Apelido: `lumen-passagens-web`
- Clique em **Registrar app**
- Copie o objeto `firebaseConfig`

---

## ✏️ Passo 3 — Editar o arquivo `js/config.js`

Abra o arquivo `js/config.js` e substitua os valores:

```js
// ─── FIREBASE ────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIza...",           // ← sua API Key do Firebase
  authDomain:        "lumen-passagens.firebaseapp.com",
  projectId:         "lumen-passagens",
  storageBucket:     "lumen-passagens.appspot.com",
  messagingSenderId: "12345678",
  appId:             "1:12345678:web:..."
};

// ─── GEMINI ──────────────────────────────────────────
const GEMINI_API_KEY = "AIzaSy...";       // ← sua chave do Google AI Studio
```

> ⚠️ **Atenção:** Este é o ÚNICO arquivo que você precisa editar.
> Não altere os outros arquivos JS a menos que queira personalizar o sistema.

---

## 👤 Passo 4 — Criar o Primeiro Usuário Admin

1. Abra o `index.html` no navegador (clique duplo no arquivo)
2. Clique em **"Solicitar acesso"** e crie sua conta
3. Vá ao **Firebase Console → Firestore → users**
4. Encontre seu documento (use **Authentication → Usuários** para ver seu UID)
5. Edite os campos:
   - `approved`: `true` (boolean)
   - `role`: `admin` (string)
6. Salve → volte ao site e faça login

---

## 🌐 Passo 5 — Publicar o Site (Opcional)

### Opção A — Netlify (mais fácil, gratuito)
1. Acesse **https://app.netlify.com**
2. Arraste a **pasta inteira** `lumen-passagens/` para a área de deploy
3. Pronto! O site ficará online instantaneamente.

### Opção B — Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: .  (pasta raiz)
# Single-page app: No
firebase deploy
```

### Opção C — GitHub Pages
1. Crie um repositório no GitHub
2. Faça upload de todos os arquivos mantendo a estrutura de pastas
3. Ative Pages em **Settings → Pages → Branch: main**

---

## 🤖 Como Usar o Assistente Gemini

O botão **"Gemini IA"** está disponível no topbar e no sidebar.

### Exemplos de perguntas:
- *"Quais solicitações estão pendentes e são urgentes?"*
- *"Qual o gasto do mês e como está em relação ao orçamento?"*
- *"Sugira um orçamento mensal baseado no histórico de gastos"*
- *"Há viagens aprovadas sem passagem comprada nos próximos 7 dias?"*
- *"Analise os fornecedores mais utilizados e seus custos"*
- *"Faça um resumo executivo do mês para apresentar ao gestor"*

Também há **botões ✨ Gemini** em cada página para análises específicas.

---

## 💰 Sistema de Alertas de Orçamento

Configure em **Orçamento & Alertas**:

| Situação | Alerta | Cor |
|----------|--------|-----|
| < 60% utilizado | ✅ Tudo certo | Verde |
| ≥ 60% utilizado | ⚠️ Atenção | Amarelo |
| ≥ 80% utilizado | 🚨 Crítico | Vermelho |
| Na hora de comprar | Prévia do impacto | Automático |

Os alertas aparecem em:
- Dashboard (topo)
- Página Financeiro
- Página Orçamento & Alertas
- Modal de registro de compra (antes de confirmar)

---

## 📋 Páginas do Sistema

| Página | Acesso | Descrição |
|--------|--------|-----------|
| Dashboard | Admin | KPIs, alertas, gráficos, recentes |
| Solicitações | Admin | Lista completa com filtros |
| Nova Solicitação | Todos | Formulário de solicitação |
| Minhas Solicitações | Todos | Histórico pessoal |
| Controle Financeiro | Admin | Gastos por período |
| Orçamento & Alertas | Admin | Configuração de limites |
| Fornecedores | Admin | CRUD de fornecedores |
| Indicadores | Admin | 6 gráficos + KPIs |
| Calendário | Admin | Visualização mensal |
| Usuários | Admin | Aprovação e gestão |

---

## 📦 Exportações

- **Excel (.xlsx)**: Solicitações completas, Controle Financeiro
- **CSV**: Solicitações
- **PDF**: Dashboard, Solicitações, Financeiro, Indicadores, Calendário, Solicitação individual

---

## 🔄 Fluxo de Status

```
Pendente → Em Análise → Aprovada → Comprada → Concluída
                    ↘              ↘
                  Reprovada      Reprovada
```

---

## 🆘 Suporte

- Firebase: https://firebase.google.com/docs
- Gemini API: https://ai.google.dev/docs
- Google AI Studio: https://aistudio.google.com
