# Stato Nodex — 23 ottobre 2026

## Milestone

**M0–M3 completate.** Nessun lavoro iniziato su M4.

Scenario M3 verificato nel desktop reale: Varek e Gilda citati nella Sessione 12
producono due menzioni dalla sessione, nessuna alleanza. Una relazione manuale
«Varek accusa Gilda», sospetta e attribuita a un blocco, è un arco distinto.
Clic su nodi/archi, apertura del blocco fonte, modifica della certezza e
eliminazione confermata funzionano. Dopo riavvio grafo, UUID, relazione,
evidenza e documento sono identici.

## Funziona

- Campagne, diario e Codex M0–M2 conservati; migrazione 004 additiva per relazioni.
- Relazioni direzionali con etichetta, quattro certezze, evidenza, note e fonte
  opzionale sessione/pagina/blocco. Revisioni su modifica/eliminazione.
- Cytoscape con menzioni tratteggiate e relazioni continue; etichette e certezza
  visibili, legenda, controlli zoom/adatta e alternativa testuale da tastiera.
- Filtri tipo, menzioni/relazioni, certezza, ricerca nodi, sessione fonte e
  vicinato 1/2. Risposta limitata a 150 nodi/400 archi, con conteggi e avviso.
- Fonte rimossa segnalata senza cancellare l'evidenza. Form aperto protetto da
  navigazione/chiusura; eliminazione solo dopo conferma con Tab/Escape.
- Canvas e libreria caricati solo entrando nel grafo. Nessun servizio remoto.

## Verifiche effettive M3

| Comando / prova | Esito |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | PASS |
| `pnpm test` | PASS, 16 test UI/autosave/nomi/grafo |
| `pnpm peers check` | PASS |
| `cargo test --offline --manifest-path src-tauri/Cargo.toml` | PASS, 20 test DB/migrazioni/semantica grafo |
| `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `pnpm build`, `pnpm build:desktop` | PASS Windows x64 release |
| `node scripts/graph-smoke.mjs prepare` / `verify` | PASS, canvas Cytoscape + Tauri + SQLite reali e riavvio |
| Avvio release `http://tauri.localhost/` | PASS, asset incorporati, archivio reale leggibile e header CSP produzione verificato |
| Canale WebSocket Vite locale | PASS, connessione a `127.0.0.1:1420` nella sola configurazione dev |
| macOS/Linux, installer e QA manuale estesa | NON ESEGUITI |

Protocollo in `docs/QA.md`. Screenshot ispezionati, archivio di prova finale
`.tools/m3-smoke4`, escluso da Git. Cytoscape 3.34.4 MIT, tipi inclusi; nessuna
estensione. Rust locale `.tools/`: avvio nel README. Nessun push remoto.

## Commit recenti

- `4e27374 feat(graph): persiste relazioni esplicite e query filtrate`
- Il commit UI M3 contiene questo checkpoint e lo smoke ripetibile.
- Base M2: `5a8034d feat(knowledge): collega diario e Codex con menu e backlink`.

## Limiti noti

1. Backup/ripristino ancora assenti: sono la prossima milestone M4.
2. Chiusura forzata può perdere appunti ancora pendenti; conflitti richiedono
   riapertura senza merge automatico. Un form di relazione non ha autosave implicito.
3. Grafo: vista limitata, disposizione temporanea e metadati filtrati nel backend;
   collezioni molto grandi richiederanno misure e ottimizzazioni in M6.
4. Chunk editor ~966 kB; chunk canvas ~438 kB, entrambi caricati separatamente.
5. Piattaforme diverse da Windows, installer e QA accessibilità estesa pendenti.

## Prossimo passo esatto

**M4 — Portable backup and recovery (protect the data early)**: snapshot SQLite
consistente, archivio `.nodex` con manifest/checksum, ripristino validato e backup
preventivo. Verifica: esportare, ripristinare in un profilo temporaneo e confrontare
sessioni, pagine, menzioni, relazioni e fonti, senza copiare il DB aperto alla cieca.

Skill riutilizzate: frontend-design (layout e revisione screenshot),
vercel-react-best-practices (caricamento differito e ciclo di vita del canvas).
