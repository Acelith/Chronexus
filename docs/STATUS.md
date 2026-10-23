# Stato Chronexus — 23 ottobre 2026

## Milestone

M0–M5 ed estensione scheda/catalogo completate. **Funzionalità M6 consegnate su
Windows**, campagna di prova e backup verificati. Restano le verifiche di
installazione/disinstallazione e quelle effettive macOS/Linux della stessa M6.

## Funziona

- Campagne, sessioni/autosave, Codex con UUID/backlink, grafo con fonti/certezza,
  scheda generica estesa, inventario e incantesimi personali/catalogo opzionale.
- Ricerca FTS5 locale per campagna, filtri, apertura del blocco fonte e rebuild;
  Ctrl/⌘K e Ctrl/⌘ShiftN, riepilogo navigabile, guardie di salvataggio.
- PNG/JPEG/WebP per pagine/PG/asset, didascalia, ruolo, anteprime e zoom. Copia
  originale gestita e SHA-256; immagini comprese nel backup e nel ripristino.
  Scollegare mantiene il file recuperabile. Nessun percorso esterno necessario.
- Export ZIP Markdown/JSON con immagini, sorgenti originali e manifest.
- Sorgenti Logseq immutabili consultabili, strumenti di conversione per profili
  debug isolati; nessuna configurazione/script/Git dell’archivio viene eseguito.
- Migrazioni additive 007/008/009, backup precedenti migrati in copia. Nuovi
  backup richiedono una build compatibile con schema 009. Identificatore legacy
  it.nodex.desktop ed estensione .nodex conservati.

## Ultimo scenario reale

Speratia creata da ZIP Logseq e foto di Oran: 84 sessioni, 209 pagine, 18 asset,
36 immagini, 207 Markdown originali. Due alias in conflitto conservati nel testo
senza fusione. Foto e testo originali inclusi; trascrizione Oran parziale, valori
incerti segnalati (PF attuali non leggibili: zero tecnico da aggiornare).
Verificati riepilogo, foto/zoom, sorgente in sola lettura e ricerca.
Riavvio, backup reale, restore su profilo vuoto e secondo riavvio: dati e UUID
identici, tutti i checksum immagini/sorgenti corrispondono. Export controllato.
Dati privati in .tools/, mai nei commit o nel profilo personale.

Backup consegnato: `C:/Users/Joel/Downloads/Speratia_Chronexus_M6_2026-10-23.nodex`,
52.321.017 byte, SHA-256
`58a3e5fdc05670b46536c911eb92e5c83d7b8f86b5721c3c3adda5b893fd714c`.
Ripristinare sostituisce l’intero archivio con copia preventiva, non fonde campagne.

## Verifiche effettive

- pnpm lint / typecheck / format:check: PASS.
- pnpm test: PASS, 47 test in 15 file.
- cargo test --offline --manifest-path src-tauri/Cargo.toml: PASS, 47 test.
- cargo fmt --manifest-path src-tauri/Cargo.toml -- --check: PASS.
- cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings: PASS.
- cargo build debug, pnpm build e pnpm package:desktop: PASS Windows x64.
- Smoke desktop immagini/ricerca, export, Speratia prepare/verify/restore/verify:
  PASS, WebView2 + SQLite + file reali; solo selettori file predefiniti in debug.
- Release tauri.localhost: avvio, lettura SQLite e GET Magic Missile 200 PASS.
- Installer NSIS generato, non installato; macOS/Linux/CI non eseguiti.

## Commit M6

- 70e7880 feat(search): aggiunge ricerca FTS5 e apertura dei blocchi fonte
- 0bf403b feat(images): aggiunge immagini locali comprese nei backup
- 858085a feat(export): esporta campagne in Markdown e JSON con immagini
- ca0e79e feat(ui): aggiunge il riepilogo navigabile della campagna
- 738eb62 build(release): prepara installer Windows e matrice desktop CI
- Commit sorgenti/importazione: vedere git log (questo checkpoint accompagna la modifica).

## Avvio, Skill e prossimo passo

`pnpm desktop` con toolchain Rust; `pnpm package:desktop` per il pacchetto.
Installer: src-tauri/target/release/bundle/nsis/Chronexus_0.1.0_x64-setup.exe.
Skill lette e applicate: frontend-design (gerarchia/leggibilità),
vercel-react-best-practices (composizione e caricamento differito).

Prossimo passo esatto: **validazione release M6 su tutti i target**, installazione
Windows e CI/pacchetti macOS/Linux. Nessuna M7 definita. Limiti: installer non
firmato, bundle editor grande segnalato da Vite, backup manuali, import Logseq
solo strumento debug, un PG per campagna. Nessun push remoto eseguito.
