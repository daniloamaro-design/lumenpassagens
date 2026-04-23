# Lumen Passagens 🛫

Sistema completo de gestão de passagens para a Lumen.

## Deploy

### Opção 1 — Firebase Hosting

1. Instale o Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Faça login:
```bash
firebase login
```

3. Crie um projeto no console.firebase.google.com
   - Anote o ID do projeto (ex: `lumen-passagens-abc123`)

4. Atualize o `.firebaserc` com seu ID:
```json
{
  "projects": {
    "default": "SEU-ID-AQUI"
  }
}
```

5. Build e deploy:
```bash
npm install
npm run build
firebase deploy
```

---

### Opção 2 — Vercel (mais simples)

1. Instale a CLI da Vercel:
```bash
npm install -g vercel
```

2. Faça deploy:
```bash
vercel
```

Ou conecte o repositório GitHub diretamente em vercel.com — o Vercel detecta automaticamente as configurações.

---

### Opção 3 — GitHub Pages

1. Suba o projeto para um repositório no GitHub.

2. Nas configurações do repositório, vá em **Pages** > Source: **GitHub Actions**.

3. Crie o arquivo `.github/workflows/deploy.yml` (já incluído neste projeto).

---

## Execução local

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

---

## Credenciais padrão

| Perfil | Usuário | Senha |
|--------|---------|-------|
| Admin | `admin` | `admin123` |
| Usuário | `joao` | `123456` |
| Financeiro | `maria` | `123456` |

> ⚠️ Troque as senhas após o primeiro acesso.

---

## Funcionalidades

- ✅ Login com controle de perfis (Admin / Financeiro / Usuário)
- ✅ Solicitação de passagens (ônibus e avião)
- ✅ Média histórica por trajeto
- ✅ 3 orçamentos manuais por solicitação
- ✅ Upload de bilhete (imagem/PDF)
- ✅ Linha do tempo de aprovação
- ✅ Controle de limite por fornecedor com alerta em 50%
- ✅ Vencimentos detalhados por fornecedor
- ✅ Controle financeiro com lançamentos
- ✅ Cadastro e edição de fornecedores
- ✅ Indicadores: custo por trajeto, pessoa, motivo, tipo
- ✅ Exportação PDF, Excel e CSV
- ✅ Persistência local (localStorage)
