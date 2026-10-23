# Decisioni

## 2026-10-23 — Fondazione M0

- Rust possiede una connessione SQLite protetta da mutex, aperta nella directory
  dati Tauri; React comunica tramite comandi stretti. Nessun plugin SQL/FS nel frontend.
- SQLite incorporato tramite rusqlite (`bundled`, MIT), per comportamento coerente
  senza installazione SQLite esterna. FK attive e timeout dei lock di 5 secondi.
- Migrazioni additive e transazionali con `schema_migrations`. Non viene offerto
  un downgrade automatico distruttivo; rollback mediante versione precedente e
  snapshot a programma chiuso finché M4 non introduce backup consistenti.
- Vite/React/TypeScript; TypeScript 6 perché typescript-eslint non supporta 7.
  Dipendenze fissate nei lockfile. Tauri MIT/Apache-2.0, React/Vite MIT.
- Design: ardesia #161c28, inchiostro #101623, bordo #303a4b, testo #e7e8ed,
  testo secondario #a9b4c7, ottone #d7b978. Georgia per titoli, Segoe UI/system
  per comandi. Sidebar archivio a sinistra, diario al centro; nessun dato fittizio.
- Skill lette e applicate: frontend-design (palette, tipografia e struttura),
  vercel-react-best-practices (stato derivato e caricamento differito editor).
