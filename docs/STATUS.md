# Stato Nodex — 23 ottobre 2026

## Milestone

**M0, M1 e M2 completate. M3 in corso.**

Checkpoint M3: migrazione 004, CRUD relazioni con revisioni, fonti e query grafo
filtrata/limitata implementati. Test Rust: PASS (20); Clippy: PASS.
Interfaccia del grafo e smoke desktop ancora da completare.

Ultimo scenario desktop verificato: nella Sessione 12 crea `[[Varek]]`, apre la
pagina e il backlink, rinomina in «Varek il grigio», torna al blocco sorgente e
riavvia. Documenti, UUID e alias sono identici; collegamento e backlink risolvono
ancora la stessa pagina. Verificati anche pagina→pagina, alias ambiguo, recupero
mancante e creazione fallita con testo digitato conservato.

## Funziona

- Campagne e sessioni persistenti, editor italiano condiviso con il Codex.
- Migrazione 003 additiva: pagine tipizzate con alias/bozze e menzioni esplicite.
- Menu `[[` con selezione o creazione, titoli correnti risolti per ID stabili.
- Backlink raggruppati per sessione/pagina, anteprima e navigazione al blocco.
- Documento e indice aggiornati nella stessa transazione; confini di campagna
  verificati nel backend. Le menzioni non generano relazioni fattuali.
- Autosave serializzato e flush prima di navigare/chiudere; anche la creazione
  delle pagine pendenti è attesa. Errori visibili e appunti preservati.

## Verifiche effettive M2

| Comando / prova | Esito |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | PASS |
| `pnpm test` | PASS, 12 test UI/autosave/risoluzione nomi |
| `cargo test --offline --manifest-path src-tauri/Cargo.toml` | PASS, 13 test DB/migrazioni/menzioni |
| `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `pnpm build`, `pnpm build:desktop` | PASS, Windows x64 release; avviso chunk editor ~966 kB |
| `node scripts/knowledge-smoke.mjs prepare` / `verify` | PASS, WebView2 + Tauri + SQLite reali e riavvio |
| Release `http://tauri.localhost/` | PASS, avvio e lettura archivio reale con asset incorporati |
| macOS/Linux, installer e QA manuale estesa | NON ESEGUITI |

Protocollo ripetibile in `docs/QA.md`. Screenshot ispezionati, dati di prova
separati in `.tools/m2-smoke6`, esclusi da Git. Nessuna nuova dipendenza.
Rust locale `.tools/`: avvio PowerShell nel README. Sandbox: Git/app-data
richiedono esecuzione fuori sandbox; nessun push remoto.

## Commit recenti

- `e9c1fc0 feat(knowledge): persiste pagine Codex e menzioni per blocco`
- Il commit UI M2 contiene questo checkpoint e lo smoke ripetibile.
- Base precedente: `414415b feat(journal): aggiunge editor italiano e autosave affidabile`.

## Limiti noti

1. Nessun backup fino a M4, nessuna cancellazione/archiviazione esposta.
2. Chiusura forzata può perdere modifiche ancora pendenti; conflitti di documento
   richiedono copia e riapertura, senza merge automatico.
3. Testo `[[...]]` non confermato resta testo; nessuna inferenza automatica.
4. Le anteprime delle fonti conservano il nome scritto all'epoca, anche dopo rinomina.
5. Editor voluminoso, QA multipiattaforma e distribuzione rinviati a M6.

## Prossimo passo esatto

**M3 — Meaningful graph**: grafo navigabile con menzioni e relazioni dichiarate
separate, tipo/direzione/certezza e fonte. Verificare che citare Varek e la Gilda
non crei un'alleanza; una relazione sospetta esplicita deve essere distinta.

Skill riutilizzate: frontend-design (coerenza e revisione visiva),
vercel-react-best-practices (caricamento differito e fetch indipendenti paralleli).
