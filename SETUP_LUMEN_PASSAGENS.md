# 🚀 Guia de Configuração — Lumen Passagens

## Passo 1 — Criar o Projeto Firebase

1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"**
3. Dê o nome: `lumen-passagens` (ou reutilize seu projeto Lumen existente)
4. Desative o Google Analytics (opcional) → Clique em **Criar projeto**

---

## Passo 2 — Ativar Authentication

1. No painel do projeto, vá em **Authentication → Começar**
2. Clique na aba **Método de login**
3. Ative **E-mail/senha** → Salvar

---

## Passo 3 — Criar o Banco Firestore

1. Vá em **Firestore Database → Criar banco de dados**
2. Escolha **Modo de produção**
3. Selecione a região **southamerica-east1 (São Paulo)**
4. Clique em **Ativar**

---

## Passo 4 — Configurar Regras de Segurança do Firestore

Vá em **Firestore → Regras** e substitua o conteúdo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuários: cada um lê/escreve seu próprio doc; admin lê todos
    match /users/{userId} {
      allow read, update: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Solicitações: usuários autenticados e aprovados
    match /passagens_solicitacoes/{docId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true;
    }

    // Fornecedores: leitura para aprovados, escrita só admin
    match /passagens_fornecedores/{docId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

Clique em **Publicar**.

---

## Passo 5 — Obter as Credenciais do Firebase

1. No painel do projeto, clique no ícone **`</>`** (Web)
2. Dê um apelido ao app: `lumen-passagens-web`
3. **Não** marque Firebase Hosting
4. Clique em **Registrar app**
5. Copie o objeto `firebaseConfig` que aparecer:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "lumen-passagens.firebaseapp.com",
  projectId: "lumen-passagens",
  storageBucket: "lumen-passagens.appspot.com",
  messagingSenderId: "12345678",
  appId: "1:12345678:web:abcdef"
};
```

---

## Passo 6 — Colar as Credenciais no Site

1. Abra o arquivo `lumen_passagens.html` em qualquer editor de texto (Bloco de Notas, VSCode, Notepad++...)
2. Localize o trecho no início do JavaScript:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT.firebaseapp.com",
  ...
```

3. Substitua pelos seus dados reais copiados do passo 5
4. Salve o arquivo

---

## Passo 7 — Criar o Primeiro Usuário Admin

Como a aprovação exige um admin, você precisa criar o primeiro manualmente:

1. Abra o `lumen_passagens.html` no navegador (duplo clique no arquivo)
2. Clique em **"Criar conta"** e registre sua conta com seu e-mail
3. Volte ao **Firebase Console → Firestore → passagens_solicitacoes**
4. Clique em **users** na lista de coleções
5. Encontre o documento com seu UID (aparece como ID do documento)
6. Clique nele → edite os campos:
   - `approved`: `true` (boolean)
   - `role`: `admin` (string)
7. Salve
8. Volte ao site e faça login — você já terá acesso admin!

> **Dica:** Para encontrar seu UID facilmente, acesse **Authentication → Usuários** no Firebase Console.

---

## Passo 8 — Publicar o Site (Opcional)

### Opção A — Firebase Hosting (recomendado, gratuito)

```bash
# Instale o Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicialize na pasta do arquivo
firebase init hosting

# Publique
firebase deploy
```

### Opção B — Netlify (arrastar e soltar)

1. Acesse **https://app.netlify.com**
2. Arraste o arquivo `lumen_passagens.html` para a área de deploy
3. Pronto! O site terá um link público instantaneamente.

### Opção C — GitHub Pages

1. Crie um repositório no GitHub
2. Faça upload do arquivo renomeando para `index.html`
3. Ative Pages em **Settings → Pages → Branch: main**

---

## Recursos do Sistema

| Página | Acesso | Descrição |
|--------|--------|-----------|
| Dashboard | Admin | KPIs, alertas, gráficos, solicitações recentes |
| Todas as Solicitações | Admin | Lista completa com filtros avançados |
| Nova Solicitação | Todos | Formulário completo de solicitação |
| Minhas Solicitações | Todos | Histórico pessoal do usuário |
| Controle Financeiro | Admin | Gastos por período, gráficos |
| Fornecedores | Admin | CRUD de fornecedores |
| Indicadores | Admin | 6 gráficos + KPIs de análise |
| Calendário de Viagens | Todos | Visualização mensal das viagens |
| Usuários | Admin | Aprovação e gestão de acessos |

---

## Exportações Disponíveis

- **Excel (.xlsx)**: Solicitações completas, Controle Financeiro
- **CSV**: Solicitações (compatível com qualquer sistema)
- **PDF**: Dashboard, Todas as Solicitações, Financeiro, Indicadores, Calendário, Solicitação individual

---

## Fluxo de Status das Passagens

```
Pendente → Em Análise → Aprovada → Comprada → Concluída
                    ↘                ↘
                   Reprovada       Reprovada
```

---

## Alertas Automáticos

O sistema emite alertas automáticos no Dashboard quando há **viagens aprovadas com menos de 7 dias** sem passagem comprada.

---

## Política de Antecedência (integrada ao formulário)

| Tipo | Antecedência Mínima |
|------|---------------------|
| Ônibus 🚌 | 72 horas (3 dias) |
| Avião ✈️ | 7 dias |

---

## Suporte

Em caso de dúvidas sobre Firebase, acesse a documentação oficial:
- https://firebase.google.com/docs/firestore
- https://firebase.google.com/docs/auth
