/* ═══════════════════════════════════════════════════════════════
   LUMEN PASSAGENS — Configurações
   ⚠️  EDITE ESTE ARQUIVO com suas credenciais reais
   ═══════════════════════════════════════════════════════════════ */

// ─── 1. FIREBASE ─────────────────────────────────────────────────
// Como obter: Firebase Console → Configurações do Projeto → Seus apps → </> Web
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBDOv-Fx7056KRX7AnwQ53wuTAnJlUqDXg",
  authDomain: "lumen-passagens.firebaseapp.com",
  projectId: "lumen-passagens",
  storageBucket: "lumen-passagens.firebasestorage.app",
  messagingSenderId: "183562911494",
  appId: "1:183562911494:web:1d153435a14c25e0dd6887"
};

// ─── 2. GEMINI API KEY ────────────────────────────────────────────
// Como obter: https://aistudio.google.com/apikey
// → Clique em "Get API Key" → Crie ou selecione um projeto → Copie a chave
const GEMINI_API_KEY = "SUA_GEMINI_API_KEY_AQUI";

// Modelo Gemini a usar (não altere a menos que queira outro modelo)
const GEMINI_MODEL = "gemini-2.0-flash";

// ─── 3. CONSTANTES DO SISTEMA ────────────────────────────────────
const STATUS_LABELS = {
  pendente:   "Pendente",
  em_analise: "Em Análise",
  aprovada:   "Aprovada",
  comprada:   "Comprada",
  concluida:  "Concluída",
  reprovada:  "Reprovada"
};

const MOTIVOS = [
  "CDTJ",
  "OUTROS",
  "TRANSFERÊNCIA",
  "VISITAR A FAMÍLIA",
  "RETIROS",
  "SELO LUMEN"
];

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const CORES_CHART = [
  "#2B9FA8","#D4A827","#1A7A44","#C0392B","#6C3483",
  "#D4890A","#17A589","#154360","#7D6608","#2E86C1"
];

// ─── INICIALIZAÇÃO FIREBASE ───────────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();
