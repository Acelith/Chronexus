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

## 2026-10-23 — Persistenza M1

- Migrazione 002 aggiunge campagne/sessioni con UUID, vincoli, indice cronologico
  per numero e documento JSON canonico versionato. Nessuna copia Markdown modificabile.
- Ogni comando di sessione riceve la campagna e ne verifica i confini nel backend.
- Revisioni ottimistiche impediscono sovrascritture da finestre/app concorrenti:
  un conflitto blocca il salvataggio e invita a copiare gli appunti.
- Documenti limitati a 2 MB, 10.000 blocchi e profondità 12; solo paragrafi,
  titoli, elenchi e citazioni. Media e upload fuori scope.
- Errori di apertura DB tornano al frontend: la finestra rimane disponibile
  anche con directory non accessibile o schema più recente.
