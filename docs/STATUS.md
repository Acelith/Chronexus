# Pianificazione — 25 ottobre 2026: M23, M24, M25

Aggiunte su richiesta dell’utente dopo la release 0.8.0, nessuna implementata:
M23 audit completo del codice (prossima), M24 campagna condivisa (proposta: server
Chronexus self-hosted con condivisione selettiva, P2P valutato e non scelto come
base; confermato dall’utente, da sviluppare in un repository separato), M25 app Android APK con lo stesso account del
server. Dettagli in ROADMAP.

# Stato Chronexus — 25 ottobre 2026 (release 0.8.0)

Pubblicata la release [0.8.0](https://github.com/Acelith/Chronexus/releases/tag/v0.8.0)
con M19, M20, M21 e M22. Sorgente compilato `c540c2d`, tag annotato `v0.8.0`,
`main` su origin. Installer NSIS Windows x64 compilato dal commit `c540c2d` (tag annotato `v0.8.0`),
firmato updater e verificato con la chiave di produzione
(`updates_signed_release_package_matches_production_key`). Dimensione 33.072.040
byte, SHA-256 `0079f8b8509836e006ad42d37338212593c25b9719119b1e49f2961bbb4d6b3a`.
Verifiche prima della build: 134 test Rust (`--test-threads=1`), clippy
`-D warnings`, 332 test frontend, tsc, eslint, controllo cataloghi, 27 test Python
degli script di rilascio. Bozza con tre allegati caricati e riscaricati, poi
finalizzata: download anonimi e API `releases/latest` = v0.8.0 verificati.
Non eseguiti: installazione o upgrade reale, macOS/Linux.

# Stato Chronexus — 25 ottobre 2026 (M19)

**M19 — Backup nei Documenti, periodici e di aggiornamento.** Consegnata su
Windows, non in una release, nessun push. Modulo `src-tauri/src/backup_folder`:
`Documenti/Chronexus/{Backup periodici,Backup aggiornamenti}` creata solo al primo
backup o apertura richiesta, mai attraverso link simbolici/giunzioni o file al
posto della cartella. Impostazioni dell’app → Backup (anche senza campagna):
attivazione (predefinito **spento**), ogni giorno/settimana/N ore (2–72), copie
1–60, cartella alternativa solo dal selettore di sistema, avviso cloud, ultimo
successo, prossimo, ultimo errore con azione, «Esegui backup ora», «Apri
cartella». Preferenze `backup-preferences.json` e indice `periodic-backups.json`
(SHA-256) nella radice dati, fuori dalle generazioni di ripristino. Esecuzione
solo con l’app aperta e inattiva (45 s senza input, nessun campo di testo attivo,
nessun dialogo/bozza/operazione; il backend salta con AI, aggiornamento, archivio
occupato o ripristino in attesa); un errore attende un intero intervallo. La
rotazione avviene solo dopo un nuovo backup verificato e cancella solo file
registrati con hash invariato nella stessa cartella. I backup M15 vanno in
«Backup aggiornamenti» (ricevuta con `backupPreferences`), con ripiego avvisato in
`update-backups/`; se falliscono entrambi l’installer non parte. Backup e
ripristino elenca le cartelle con tipo, data, dimensione, ripristino M4 e copia
verificata dei vecchi backup di aggiornamento senza cancellare l’originale.

Verifiche realmente eseguite:
- `cargo test`: 134 superati con `--test-threads=1` (12 nuovi M19, giunzione
  Windows reale inclusa). In parallelo fallisce a intermittenza il test MCP
  `transport_auth_origin_scoping…`, già instabile prima di M19 e verde da solo.
- `cargo fmt --check`, `cargo clippy --all-targets -D warnings`: superati.
- `pnpm typecheck`, `pnpm lint`, `prettier --check`, `pnpm test`: 332 test superati.
- Collaudo desktop isolato (`scripts/qa/m19-backups.mjs`, Documenti simulati con
  spazi e Unicode): salto durante la scrittura, backup automatico all’inattività,
  rotazione con file manuale intatto, ripresa dopo riavvio, copia legacy
  verificata, ripristino reale con immagine, preferenze invariate; axe senza
  violazioni nei due pannelli.
- Non verificati: macOS/Linux, Documenti reindirizzati reali, disco pieno e sola
  lettura fisici, installazione reale di un aggiornamento con backup nei Documenti;
  nuove stringhe non tradotte (ripiego italiano).

Prossimo passo: nessuna milestone pianificata aperta; eventuale release con
M19–M22 solo su richiesta.

# Stato Chronexus — 25 ottobre 2026 (M21, M22, M20)

Eseguite su richiesta dell’utente; M19 spostata in fondo alla roadmap. Versione
sorgente 0.7.0, nessuna release nuova, nessun push.

**M22 — AI locale dalle impostazioni.** Impostazioni dell’app → AI locale:
componenti. «Controlla componenti» (solo su clic): Ollama, cloud bloccato, GPU via
`nvidia-smi`, spazio libero, stato di Qwen3.8-27B e Gemma 4 12B rispetto ai pesi
qualificati. «Installa Ollama…» scarica Ollama 0.40.10 dal solo URL ufficiale
GitHub (redirect ammessi solo verso gli host asset di GitHub), verifica dimensione e
SHA-256 `d52aea2d…` (confrontato con il `sha256sum.txt` ufficiale), estrae in una
cartella temporanea con controllo dei percorsi e la attiva solo a verifica conclusa
(`ai-runtime/ollama-0.40.10` nella cartella dati, fuori da backup e Git). Avvio e
arresto espliciti; il runtime gestito si chiude con Chronexus, non tocca runtime
esistenti né porte occupate e richiede il cloud disabilitato. «Scarica modello…»
chiede al runtime attivo il solo modello scelto e lo dichiara pronto solo se il
digest dei pesi coincide con la policy M18. Rimozione limitata al runtime gestito.

**M21 — Identità visiva.** Icona dell’app dall’araldo (`assets/chronexus.svg` =
`assets/brand/chronexus-icon.svg`, generazione `pnpm icons` provata), logo verticale
nella barra laterale con titolo accessibile «Chronexus».

**M20 — README.** README italiano e inglese con intestazione, badge veri, tabella
funzioni con icone del progetto, installazione, avvisi, crediti e licenza Apache-2.0
del file LICENSE. Contenuti tecnici spostati senza perdite in `docs/GUIDE.md` e
`docs/DEVELOPMENT.md`. Cinque schermate WebP da campagna sintetica (circa 0,5 MB).

Verifiche realmente eseguite:
- `cargo test`: 122 test, inclusi 5 nuovi M22 (download/hash/redirect, archivi
  ostili, annullamento, pull con verifica pesi, stato senza rete); 10 esecuzioni
  complete senza fallimenti M22 dopo aver corretto un keep-alive nel server finto
  del test. `transport_auth…` (MCP) fallisce in modo intermittente anche da solo e
  anche sul commit HEAD pulito: instabilità preesistente. clippy e fmt PASS.
- `pnpm test` 326 PASS; lint, typecheck, format, i18n:check e build PASS.
- Desktop Windows debug, profili isolati: `scripts/qa/m22-ai-setup.mjs install`
  reale (download ufficiale 1,59 GB, verifica ed estrazione in 128 s, avvio con
  cloud disabilitato, arresto, nessun file parziale); pull reale di Gemma 4 12B già
  presente nel runtime di sviluppo: ricontrollo del registro e pesi verificati
  «Pronto» in 2 s. Logo a 1440/1200/760 px, axe 0 violazioni su barra laterale e
  pannello AI. Schermate README da `scripts/qa/m20-readme-media.mjs`.

Limiti: download completo dei 17,7 GB di Qwen3.8-27B tramite interfaccia non
ripetuto; installazione guidata solo Windows x64; `Cargo.toml` dichiara MIT mentre
`LICENSE` è Apache-2.0: incoerenza segnalata all’utente, non modificata; nuove
stringhe con fallback italiano; macOS/Linux non provati.

Skill: frontend-design e impeccable (craft-floor) per README, icone SVG del progetto
al posto delle emoji e composizione del logo; accessibility per pannello AI e nome
del logo; react-testing per i test; imagegen non necessaria (immagini dell’utente).

Push del 25/10/2026: `main` su origin a 7f2dd90 (nessuna release). Resa del README
verificata sulla pagina reale di github.com (Forgejo 12.0.4): callout WARNING/
IMPORTANT/NOTE, due sezioni richiudibili, centrature, tre tabelle, tutte le immagini
e i badge caricati (release v0.7.0), 12 link interni con risposta 200.

Prossima e unica milestone pianificata: M19.

# Pianificazione — 25 ottobre 2026: M22 assieme ai loghi M21

Aggiunta M22: installazione guidata di Ollama e modelli da Impostazioni dell’app,
nella stessa prossima fase dei loghi M21, prima di M19/M20. Qwen3.8-27B principale,
Gemma secondaria facoltativa; stato componenti, requisiti/spazio/licenze,
download espliciti con avanzamento/annullamento e verifica integrità. Runtime
preesistenti e attivazione delle campagne preservati, nessun cloud o setup
automatico. QLoRA escluso dal download ordinario. Solo pianificazione: codice,
versione, schema e pacchetto 0.7.0 invariati; nessuna compilazione/installazione
o pubblicazione. Verifica documentale e `git diff --check`, test app non eseguiti
per questa modifica solo documentale. Dettagli e accettazione in ROADMAP M22.

# Stato Chronexus — 25 ottobre 2026: M18

Implementata Windows, versione 0.7.0 compilata e consegnata localmente. Qwen3.8-27B ufficiale
Q4_K_M è la prima scelta per assistente/wiki/strumento traduzioni, Gemma 4 12B
secondaria esplicita e unica base QLoRA. Policy condivisa con pesi fissati;
48 layer GPU/batch 256, contesto 8192: esecuzione mista GPU/RAM sulla 4080 SUPER
16 GB. Profilo 99 layer scartato per pressione di memoria/latenza. Nessun
cloud, download, attivazione di campagna o fallback automatico.

Schema 018 disabilita i vecchi Qwen globali/per campagna senza riscrivere
nomi/digest, risposte o citazioni. Ripristino reale del backup sintetico 017
verificato nella nuova app; Gemma attiva conservata. Traduttore v2 con selezione
esplicita e cache coerente col modello; copie v1 valide nei backup, mai attribuite
al nuovo modello. Script installer vecchio Qwen ritirati; bundle Gemma solo con
--secondary-gemma. Identità, setup e misure in docs/AI_MODELS.md.

Verifiche effettive:
- Qualifica prima delle modifiche: SHA-256 GGUF indipendente, Qwen e Gemma 35/35
  su fonti identiche; benchmark nativo 40/40 ciascuno, dati canonici invariati.
- UI ripristino/migrazione: storia e citazioni correnti intatte, vecchio Qwen
  rifiutato, consenso necessario, Qwen primo, Gemma secondaria, training corretto.
- Wiki nativa: italiano, numeri/negazione/raggio conservati, originale intatto;
  cache visibile con runtime spento e HTTPS browser bloccato. Annullamento e
  cache clear impediscono copie parziali/tardive e liberano il blocco AI.
- Axe 0 violazioni su impostazioni/voce; viste 1200/760 px ispezionate.
- Frontend 162 test PASS; i18n 14 PASS; lint/TypeScript/build PASS. Avviso chunk
  editor >500 kB preesistente. Formattazione finale PASS.
- Rust 117 unitari + 1 integrazione PASS; 2 ignorati (fixture Wikidot locale e
  firma sul pacchetto finale). Test della firma poi eseguito esplicitamente sul
  pacchetto reale: PASS, copia manomessa rifiutata. Clippy all-targets/all-features
  -D warnings PASS.
- Script release 27, traduzione locale 5 e MCP 5 PASS. Build debug Windows PASS.
- React Doctor 84/100 (baseline 81), avviso dimensione TrainingPanel; nessun errore.
  Impeccable statico sui quattro componenti: nessuna segnalazione, limiti statici
  compensati da screenshot e axe. Detector nativo: avviso preesistente di righe
  lunghe nell’aiuto generale wiki, esterno ai controlli modificati.

Consegna locale 0.7.0: sorgente/tag `v0.7.0` → `2052df7`
(`feat(ai): adotta Qwen3.8-27B e mantiene Gemma secondaria`). Build NSIS x64
firmata updater da checkout isolato del commit, 32.630.931 byte; SHA-256
`69b9ef340f43f177b266c99ce1f9e1eac9320fdf3229ff1500106389350e270e`.
Installer, firma, manifesto e report in
`installers/Chronexus-0.7.0-Windows-x64/`, fuori Git. Firma reale con chiave di
produzione PASS; nessuna installazione. Il primo push è stato rifiutato dal
server per credenziali errate/scadute, prima dell’avvio del publisher.
L’utente ha quindi chiesto di lasciare la pubblicazione: non riprenderla senza
nuova richiesta. Nessuna release 0.7.0 creata; canale pubblico precedente 0.6.0.

Limiti: qualifica su una GPU Windows, nessuna installazione sul profilo personale
o prova fisica senza rete; altri OS/hardware pendenti. Traduzioni da revisionare
(soprattutto significato/terminologia), nessuna garanzia di regole ufficiali.
Prossima milestone pianificata: M21, poi M19/M20 secondo ROADMAP.
Skill applicate: Rust Best Practices/Tauri v2 (policy e IPC), SQLite Expert
(migrazione/backup), Impeccable (stati coerenti con UI esistente), React Testing
e React Doctor (regressioni), Systematic Debugging (memoria/formato/semantica),
Webapp Testing (collaudi desktop isolati). Pesi/fixture/report fuori Git.

# Pianificazione — 25 ottobre 2026: M21 prima di tutto

Solo documentazione e asset. L’utente ha scelto i loghi dell’araldo (icona,
marchio orizzontale, logo verticale): originali in `assets/brand/source/`, varianti
preparate in `assets/brand/` (icona con angoli trasparenti provata con `tauri icon`).
Su sua istruzione non sono ancora integrati: nuova M21 in ROADMAP, da eseguire
**prima** di M18, M19, M20 e di ogni altra milestone aperta. Un’integrazione
iniziata in questo turno è stata annullata prima del commit; app, versione e
release invariate.

# Pianificazione — 25 ottobre 2026: M20

Solo documentazione. Nuova M20 in ROADMAP: README di qualità ispirato ai progetti
indicati dall’utente (intestazione centrata, badge reali, screenshot sintetici,
tabelle di funzioni e installazione, callout e sezioni richiudibili, README.en.md,
contenuti tecnici spostati in docs). Codice, versione e release invariati.

# Pianificazione — 25 ottobre 2026: M19

Solo documentazione. Nuova M19 in ROADMAP: cartella `Chronexus/` nei Documenti con
«Backup periodici» e «Backup aggiornamenti», backup periodici configurabili
nell’app (solo ad app aperta e inattiva, rotazione solo dei periodici registrati) e
backup pre-aggiornamento M15 spostati lì con ripiego nella cartella dati e nessuna
eliminazione automatica. Codice, schema, versione e release invariati; nessuna
pubblicazione.

# Stato Chronexus — 25 ottobre 2026: M17

M17 implementata su Windows: traduzione esplicita della voce wiki nella lingua
selezionata dell’app, per Wikidot e Open5e. Originale/provenienza e importazioni
immutati; bozze automatiche separate e consultabili offline. Schema 017 additivo,
cache limitata a 100 copie, inclusa nei backup e nello svuotamento per provider.
I controlli scartano risultati incompleti, numeri alterati e scritture tardive.

Verifiche effettive:
- Lint e TypeScript PASS; frontend 159 test PASS; i18n 14 test PASS.
- Rust 115 test PASS complessivi, 2 ignorati (fixture Wikidot locale e prova della
  firma sul pacchetto finale); prova firma poi eseguita PASS, vedi sotto. Migrazione 016 → 017,
  sorgenti immutate, cache per fonte/lingua e backup/restore verificati.
- Build frontend PASS (avviso preesistente chunk >500 kB); build debug Windows
  PASS; Clippy senza warning PASS. Formattazione finale PASS.
- QA desktop su profilo sintetico isolato: Qwen3 4b-instruct su RTX 4080 SUPER,
  GGUF verificato, cloud disabilitato, 37/37 layer GPU. Traduzione italiana,
  tedesca e araba con numeri/negazione conservati nella fixture; titoli/termini
  variabili confermano che non è una revisione linguistica o regole ufficiali.
- Originale conservato; copia riletta anche con runtime spento e richieste browser
  pubbliche bloccate. Non equivale a una prova fisica senza rete/firewall.
- Annullamento reale senza copia parziale; cache clear durante l’inferenza
  interrompe il lavoro e rifiuta la scrittura tardiva; blocco AI condiviso liberato.
- Axe sulla voce 0 violazioni; vista 1200/760 px ispezionata. React Doctor 81/100,
  nessuna nuova segnalazione dopo la correzione delle identità dei blocchi.
- Test script rilascio 26 PASS; protocollo MCP 5 PASS, senza nuovi tool esposti.

Distribuzione **0.6.0 pubblicata**: https://github.com/Acelith/Chronexus/releases/tag/v0.6.0
(release id 5, tre allegati). Sorgente/tag `v0.6.0` → `b4f04c4`
(`feat(wiki): traduce le voci nella lingua dell'app con cache locale`).
Build NSIS Windows x64 firmata updater, installer 32.603.355 byte; SHA-256
`a7bbe026e68ef4122499f8f8ac1d1bc50d2551bbdd7e1a73110338d984b8f675`.
Firma del pacchetto reale con chiave di produzione PASS, copia manomessa rifiutata
(test ignorato eseguito esplicitamente). Upload, riscaricamento/checksum e download
anonimi dei tre allegati, manifesto statico e API stable latest verificati dal
publisher. Installer e report in `installers/Chronexus-0.6.0-Windows-x64/` fuori Git.
Non installata sul profilo personale: upgrade reale 0.5.0 → 0.6.0 ancora da provare.
Nessun contenuto/fixture privata o peso AI in Git. Prove locali in `.tools/m17/`,
script ripetibili in `scripts/qa/m17-*.mjs`, guida `docs/WIKI_TRANSLATION.md`.

Limiti: prima traduzione richiede Ollama/GPU e Qwen approvato già presenti;
24.000 byte/500 frammenti/240 s, errore e originale per i testi oltre limite;
ticinese e altre lingue da revisionare, Klingon/Romulano con fallback esplicito.
macOS/Linux, lettori assistivi reali e upgrade installato restano aperti.
**Prossima milestone: M18**, sostituzione dei Qwen con il modello locale
qualificato, ancora pianificata. Non anticipata da M17.

Skill applicate: Tauri v2 e Rust Best Practices (IPC, runtime e validazioni),
SQLite Expert (migrazione/cache), Impeccable (contesto esistente e stati UI),
React Testing e React Doctor (test e controllo regressioni), Systematic Debugging
(formato JSON/numeri), Webapp Testing (QA desktop) e Computer Use (ricognizione delle finestre).

# Pianificazione — 25 ottobre 2026: M18

Solo documentazione. Richiesta: rimuovere tutti i Qwen e usare «Qwen3.8-max».
Verifica: Qwen3.8-Max ha 2,4 T parametri ed è un’API cloud o pesi da server
multi-GPU; non adatto alla RTX 4080 SUPER 16 GB né alla regola «nessuna AI esterna».
Scelta dell’utente: Qwen3.8-27B aperto in locale. Nuova M18 in ROADMAP (M17 è usato
da un lavoro concorrente di traduzione della wiki, non toccato). Codice, schema,
versione 0.5.0 e release invariati; nessuna pubblicazione.

# Release 0.5.0 — 25 ottobre 2026: pubblicata

https://github.com/Acelith/Chronexus/releases/tag/v0.5.0 — release id 4, tre
allegati. Publisher: bozza, upload e riscaricamento SHA-256 verificati, poi
pubblicazione con verifica dei download anonimi, della rotta statica `latest.json`
e dell’API `releases/latest` (v0.5.0, non bozza, non anteprima). Controllo curl
indipendente PASS. Tag `v0.5.0` → deef244; main su origin a 7a96ec5 prima di
questo checkpoint. Il main remoto era già a a4e1fb4 prima del push di questa
sessione: quei commit non sono stati pubblicati da questa sessione.

Incidente: durante una verifica della versione è stato avviato per errore
`.tools/m15a/target/debug/chronexus.exe` senza `NODEX_DEV_DATA_DIR` (circa un
minuto, poi chiuso normalmente). Una build debug senza override usa la cartella
dati personale `it.nodex.desktop`: se l’archivio non era bloccato da un’altra
istanza, può averlo migrato allo schema 016 (additivo) e aver scritto
`update-announcements.json`. Non verificato: la lettura della cartella personale è
stata negata dal sistema di permessi. Se la 0.4.0 installata segnala uno schema
più recente, installare la 0.5.0 pubblicata (dati conservati).
Esito: l’utente ha confermato che la 0.4.0 installata si apre normalmente, quindi
l’archivio personale non è stato migrato a 016.

# Dettagli della build 0.5.0

Su richiesta dell’utente: illustrazioni dell’araldo integrate (daed026), versione
0.5.0 (deef244, sorgente compilato, tag annotato `v0.5.0`). Build NSIS firmata
updater: `installers/Chronexus-0.5.0-Windows-x64/` (fuori Git), setup 32.558.794
byte, SHA-256 d854b0e8768d980ce3b1d288c12261b23b1d253537da33f503044142e5ca2e51;
`.sig`, `latest.json`, SHA256SUMS, report e LEGGIMI. Test crittografico ignorato
eseguito: firma valida con la chiave di produzione, copia manomessa rifiutata.
Test degli script di rilascio 26 PASS (test M11 della versione reso generico).
Installer non installato su questo computer per non toccare l’installazione
personale; upgrade reale 0.4.0 → 0.5.0 dal client non ancora provato.

# Stato Chronexus — 25 ottobre 2026 (M15a)

## M15a — Araldo degli aggiornamenti: operativa Windows (illustrazioni da fornire)

- Controllo automatico leggero dopo l’avvio (6 s): uno per sessione e al massimo
  ogni 20 ore, disattivabile in **Impostazioni dell’app → Aggiornamenti**; contatta
  solo il canale aggiornamenti M15, mai wiki o modelli AI. Errori silenziosi.
- Se esiste una versione più recente e compatibile, popup `<dialog>`: araldo con
  trombetta (emblema geometrico provvisorio), manifesto con versione e note come
  testo semplice, **Aggiorna**, **Ricordamelo più tardi** (3 giorni, per versione),
  **Ignora questa versione**; Escape = rinvio. Nessun doppio annuncio.
- Attende un’app inattiva: nessun salvataggio/modulo/ripristino/ricerca, nessuna
  bozza sporca, dialogo aperto o campo di testo con il focus, AI/addestramento o
  aggiornamento in corso. Focus sul titolo e restituito alla chiusura.
- Fanfara sintetizzata in Web Audio (nessun file), disattivabile; audio bloccato
  dalla piattaforma = annuncio completo senza suono né nuovi tentativi. Animazione
  di ~1,5 s saltabile, statica con movimento ridotto.
- **Aggiorna** apre le impostazioni e avvia il download verificato M15;
  l’installazione resta l’azione esplicita con backup obbligatorio.
- Preferenze in `update-announcements.json` fuori dai ripristini, incluse nella
  ricevuta pre-aggiornamento. SQLite resta 016.

Verifiche realmente eseguite:
- `cargo test` 109 PASS (3 nuovi di politica), clippy `-D warnings` e fmt PASS.
  Il test MCP instabile preesistente è fallito una volta, poi 2 esecuzioni verdi.
- `pnpm test` 152 PASS; lint, typecheck, format:check, i18n:check, build PASS.
- Desktop Windows debug, profili isolati, CDP 9224, `scripts/qa/m15a-herald.mjs`:
  `fixture` (offerta sintetica solo debug: popup a app inattiva, focus, axe 0
  violazioni, Escape = rinvio), `quiet` (riavvio senza controllo entro 20 ore),
  `real` (canale Forgegit reale: 0.4.0 è corrente, controllo registrato e nessun
  popup), `optout` (nessuna richiesta automatica). Schermate 1200 px e 760 px con
  movimento ridotto. Il blocco iniziale per un `<select>` con focus è stato
  corretto e coperto da test.

Limiti: upgrade reale da popup fra due release firmate non provato (serve una
0.5.0 pubblicata); illustrazioni raster dell’araldo e della pergamena da fornire
(prompt e attivazione in `assets/herald/README.md`); suono reale nella WebView2 non
ascoltato da un umano; nuove stringhe con fallback italiano; macOS/Linux non provati.
Durante il collaudo una sessione Codex usava lo stesso Vite (1420) e una propria
build debug: non toccate, collaudo eseguito su porta CDP e target separati.

Skill lette e applicate: frontend-design e impeccable (craft-floor, animate) per
direzione visiva, un solo momento animato ed emblema geometrico al posto di una
finta illustrazione SVG; accessibility per dialogo, focus, movimento ridotto e
audio; react-testing per i test con timer finti; imagegen consultata ma non
eseguibile qui (nessuno strumento integrato né OPENAI_API_KEY): l’utente fornirà
le immagini. tauri-v2/rust-best-practices consultate per comandi e preferenze.

Commit: 126d250 implementazione; checkpoint documentale nel commit successivo. Nessun push.
Prossima milestone: nessuna nuova pianificata; residui in ROADMAP.

Correzione del checkpoint M16: la frase «nessuna Skill specialistica disponibile»
era imprecisa. Le Skill locali in `~/.agents/skills` esistevano ma non erano state
cercate, quindi in M16 non sono state lette né applicate.

# Stato Chronexus — 25 ottobre 2026 (M16)

## M16 — Wikidot, scelta della fonte e cache eliminabile: operativa Windows

Implementata su richiesta esplicita dell’utente **prima di M15a**, che resta
pianificata. Versione sorgente ancora 0.4.0; schema SQLite **016** (additivo).

- **Impostazioni dell’app → Fonti D&D / Wiki**, anche senza campagna: Wikidot D&D 5e
  (predefinita) oppure Open5e. Preferenza globale `wiki-preferences.json` v1 fuori
  dalle generazioni di ripristino; file assente = Wikidot, mai scritto in lettura.
- Adapter Rust di sola lettura per `https://dnd5e.wikidot.com/`: GET HTTPS senza
  credenziali/cookie, una richiesta alla volta distanziata ≥1,5 s, 2 MiB, timeout,
  annullamento, redirect solo verso pagine ammesse, nessun nuovo tentativo automatico.
  Categorie: incantesimi, talenti, specie, background, classi/sottoclassi, oggetti
  magici. Si scarica solo l’indice della categoria; il nome cercato resta locale.
- HTML trattato come testo inerte (`scraper` 0.29, ISC): script, frame, moduli,
  media e pubblicità scartati; limiti di profondità/blocchi/testo; titolo e
  contenuto assenti → errore. Incantesimi: campi reali o elenco dei mancanti,
  mai valori inventati. Fonte dichiarata, origine (pubblicato/UA/homebrew/non
  indicata), edizione 5e-2014, URL e licenza dichiarata dalla pagina.
- Cache Wikidot separata (`wikidot_cache`, max 200 voci + indici) inclusa e
  validata nei backup. **Svuota cache offline** per Wikidot, Open5e o entrambe, con
  conferma, avviso sulle fonti AI approvate e invalidazione delle richieste in corso
  (epoch lato Rust, anche per i salvataggi Open5e). Nessun riscaricamento automatico.
- Wikidot senza informazioni (nessun risultato, errore rete/HTTP, campi non
  riconosciuti): dialogo «Vuoi usare Open5e?». Accettare salva Open5e e ripete una
  volta la ricerca; rifiuto/Escape restano su Wikidot senza richieste a Open5e.
- Importazione esplicita degli incantesimi: anteprima → modulo modificabile in
  Incantesimi → **Salva voce**. `catalogSource.provider = "wikidot"` conservato;
  le voci SRD mantengono il JSON precedente. Export con `SOURCES-WIKIDOT.txt`.
- Assistente locale: le voci Wikidot in cache sono fonti regole 5e-2014 approvabili;
  se svuotate, le nuove domande ricevono l’errore esplicito già esistente.

Verifiche realmente eseguite:
- `cargo test`: 106 PASS + 1 test QA ignorato; eseguito a parte sulle pagine reali
  salvate fuori Git: 574 incantesimi, 199 talenti, 247 classi/sottoclassi, 102
  background, 83 specie, 882 oggetti; Acid Splash senza campi mancanti. `cargo fmt`
  e `clippy --all-targets -D warnings` PASS.
- Instabilità preesistente: `automation::tests::running_bridge…` e
  `transport_auth…` falliscono a volte in parallelo; riprodotto anche sul commit
  base 66865f3 (3 fallimenti su 9 esecuzioni). Passano da soli; non modificati.
- `pnpm test` 146 PASS / 35 file; lint, typecheck, format:check, i18n:check, build PASS
  (avviso preesistente sul chunk editor).
- Desktop Windows debug, profilo isolato vuoto, `scripts/qa/m16-wiki.mjs`
  `check` + `restart` PASS: default senza campagna e senza rete all’apertura;
  indice e pagina reali di Wikidot via Rust (nessuna richiesta dalla WebView);
  importazione salvata solo esplicitamente; rifiuto senza traffico Open5e;
  accettazione con una sola richiesta Open5e; svuotamento annullato e confermato,
  Open5e e incantesimo intatti; chiusura ordinaria e riavvio senza richieste.

Limiti: nuove stringhe con fallback italiano (cataloghi non rigenerati); macOS/
Linux non provati; robots.txt e licenza verificati il 25/10/2026 ma la pagina può
dichiarare diritti diversi e i contenuti di gioco appartengono agli editori:
nessun catalogo ridistribuito. Struttura HTML futura del sito non garantita.
Nessun pacchetto, versione o release creati in questa consegna.

Commit: 2fbf17a backend/migrazione 016; 923516f interfaccia e collaudo; il
checkpoint documentale segue. Nessun push.

Skill: nessuna Skill specialistica disponibile in questa sessione oltre a quelle
generiche; usati strumenti ordinari, test Rust/Vitest e Playwright del progetto.

Prossima milestone: **M15a** (annuncio epico degli aggiornamenti).

# Aggiornamento della pianificazione — 25 ottobre 2026

## Prossime fasi: M15a, poi M16

Solo documentazione: inserita M15a prima di M16, conservando gli ID storici.
M15a pianifica un annuncio epico di aggiornamento con vassallo/araldo, trombetta
animata/audio controllabile e manifesto in pergamena, controllo all’avvio
limitato/disattivabile, rinvio/chiusura e protezione delle bozze. Il percorso di
download/firma e backup obbligatorio resta quello M15, senza installazione implicita.

M16 aggiornata: cache offline eliminabile per fonte o totale con conferma,
annullamento e invalidazione delle richieste pendenti; importazioni, campagne,
immagini, preferenze e backup preservati. Se Wikidot non fornisce informazioni,
chiedere prima di passare a Open5e; accettazione salva la fonte e permette una
nuova ricerca, rifiuto/chiusura mantengono Wikidot e non contattano l’alternativa.
Default futuro Wikidot confermato. Gestire copie in cache, errori e popup duplicati.

Allineati ROADMAP, PROJECT_SPEC, AGENTS, DECISIONS, RESEARCH_DND e UPDATES.
Versione 0.4.0/SQLite 015, sorgenti applicativi, impostazioni, pacchetti e release
invariati. Nessun popup, scraping o selettore nuovo implementato in questo turno.
Verifiche documentali PASS: 28 milestone/ordine concordi, 60 commit validi,
27 link locali, sette soli file Markdown e git diff --check;
nessun test app/build o rete, perché le modifiche riguardano soltanto Markdown.
Skill: catalogo disponibile valutato, nessuna specialistica necessaria per
questa modifica documentale; strumenti ordinari Git/file.

Prossima nuova milestone: M15a, da implementare solo su richiesta; poi M16.
Nessuna pubblicazione o nuova versione per questa pianificazione.
I checkpoint seguenti sono storici e il loro precedente ordine M16 è superato.

# Pianificazione — 25 ottobre 2026

## Roadmap riconciliata e M16 pianificata

Aggiornamento esclusivamente documentale richiesto dall’utente: tutte le milestone
esistenti hanno stato ed evidenze Git; registro e sezioni seguono l’ordine reale.
ID M0–M15 conservati; aggiunte milestone retrospettive M4a/M5a, M6a–M6d, M7a e
M8a–M8c per rinomina, scheda/API, tema/grafo, Party/Open5e, installer AI, spostamento
su D e GUI/editor. M12 e M13 sono prima della distribuzione M11, senza riscrivere
la storia. Richieste già consegnate non diventano nuovo lavoro da rifare.

**M16 da implementare:** scraping HTML pubblico Wikidot, scelta Wikidot/Open5e
nelle impostazioni globali, Wikidot predefinito quando manca una scelta esplicita,
preferenza persistente, parser/cache sicuri e separati, provenienza e importazione
esplicita. Catalogo SRD 2014 e incantesimi già salvati conservati. Specifica,
ricerca e istruzioni AI allineate; pianificazione M11–M13 obsoleta corretta.

Runtime invariato: versione 0.4.0, SQLite 015, Wiki D&D attualmente Open5e. Nessuna
modifica a UI, dati, dipendenze, installer, tag o release; nessuna implementazione
M16 dichiarata. Rimangono accettazioni M6/M7/M8/M10/M11/M15 già documentate.

Verifiche di questa consegna: confronto con cronologia Git, validazione di ordine,
ID/commit/link documentali e git diff --check: PASS (27 milestone, 60 commit
validi, 27 link locali, 6 soli file Markdown). Test dell’app/build non eseguiti
perché sono cambiati solo Markdown; i risultati sotto restano storici.
Skill: valutato il catalogo disponibile; nessuna Skill specialistica necessaria
per questo riordino documentale. Usati gli strumenti ordinari Git e file.

Prossima nuova milestone funzionale: M16, soltanto su richiesta di implementazione.
Nessuna pubblicazione/versione per questa modifica di pianificazione.

# Stato Chronexus — 25 ottobre 2026

## M15 — operativa Windows, release pubblica 0.4.0

Release pubblicata e verificata senza autenticazione:
https://github.com/Acelith/Chronexus/releases/tag/v0.4.0
API stabile: https://api.github.com/repos/Acelith/Chronexus/releases/latest
Release id 3, tre allegati: setup Windows x64, .sig e latest.json. Upload, download,
SHA-256, download anonimi e API latest PASS. Nessuna modifica alla bozza M11 id 2.
Tag v0.4.0 identifica il sorgente compilato d75f5f3; le modifiche successive sono
soltanto documentazione/strumenti di pubblicazione. Codice e tag su origin.

Impostazioni dell’app: controllo esplicito, download annullabile e installazione
ufficiale Tauri con backup verificato obbligatorio. Discovery API Forgejo stabile
con latest.json unico o manifesto HTTPS configurabile. Nessun account client,
controllo all’avvio o invio campagne. Firma vincolata a pacchetto e versione.
Prima di ogni installazione: .nodex completo con immagini/allegati gestiti e
ricevuta SHA-256/preferenze in update-backups. Fallimento blocca l’installer;
Store bloccato fino all’handoff, AI attiva rifiutata, backup mai eliminati.
Chiave privata cifrata/password Windows DPAPI fuori Git; client con sola chiave
pubblica. SQLite 015/appID invariati. Pesi/runtime AI separati. docs/UPDATES.md.

Verifiche realmente eseguite:
- pnpm test PASS: 136 test / 32 file; lint/typecheck/build/format:check PASS.
- cargo test offline PASS: 96 unitari + 1 integrazione crittografica. Il test del
  pacchetto reale, ignorato nel run ordinario, è stato eseguito esplicitamente:
  PASS per firma dell’installer definitivo e rifiuto della sua copia manomessa.
- cargo fmt e clippy --all-targets -- -D warnings PASS.
- Python manifesto 4 test PASS, publisher 4 PASS; MCP Node 5 PASS.
- React Doctor changed 82/100, nessun nuovo rilievo.
- Desktop debug autonomo/profili sintetici: schermata/versione, HTTP rifiutato,
  errore per canale non pubblicato, poi discovery del canale pubblico sia API sia
  statico, nessuna reinstallazione della versione corrente, endpoint persistente
  dopo riavvio e chiusure ordinarie PASS. Axe sulla sezione aggiornamenti: 0 rilievi.
- Backup/ripristino reale con immagini e blocco callback installer su errore PASS.
- NSIS Windows firmato updater costruito; licenze/font e mcp.mjs ispezionati
  dentro il setup. 32.006.516 byte; SHA-256:
  c8d4f7138b5be438f05ee1511f55676e109cc37cb340bd0ba31d849867da1b15.

Output locali: installers/Chronexus-0.4.0-Windows-x64, con manifesto, setup/firma,
checksum/report/ricevuta e LEGGIMI. Sorgenti: c7d95ca feature, d75f5f3 licenze,
db8fc68 publisher. Bootstrap manuale dalle versioni prive di updater, con backup
ordinario prima della prima installazione; le successive usano il nuovo flusso.
Limiti: upgrade pubblico reale tra due versioni updater non ancora eseguito,
installer non Authenticode, macOS/Linux non certificati, nuove stringhe con fallback
italiano. Non dichiarare installazioni personali o upgrade eseguiti quando non lo sono.

Skill: tauri-v2/rust-best-practices per updater e Store; react-testing/react-doctor
per UX/regressioni; frontend-design per il tema; systematic-debugging per il
manifesto Windows dei test; webapp-testing per desktop sintetico e accessibilità.
Il browser personale è stato fermato dall’utente nel turno precedente e non più
controllato. La visibilità del repository è stata modificata dall’utente e verificata.

Prossima accettazione M15: upgrade da 0.4.0 a una successiva release firmata in
ambiente isolato e runner macOS/Linux. Milestone di distribuzione M11 ancora
aperta per i pacchetti AI grandi; nessun loro nuovo upload durante M15.
I checkpoint seguenti sono storici.

## M14 — integrazione nascosta per assistenti esterni, versione 0.3.0

Operativa su Windows: bridge locale autenticato, disattivo all'avvio ordinario,
adattatore MCP stdio incluso nelle risorse, 18 strumenti per sessioni/appunti,
Codex, scheda, party e asset. Scrittura abilitata esplicitamente su una sola
campagna; letture/revisioni/etag, nessun SQL, cancellazione o controllo AI.
L'assistente integrato resta escluso. Nessun menu o pulsante aggiunto.
Viste pulite aggiornate da eventi; editor sporchi rinviano il refresh, bozze
metadati conservate e salvataggi superati rifiutati. SQLite 015 e backup invariati.
Istruzioni pratiche e configurazione client: docs/AUTOMATION.md.

Verifiche realmente eseguite:
- `pnpm test`: PASS, 131 test / 31 file; inclusi refresh e bozza Codex.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm format:check`: PASS.
- `node --test scripts/automation/mcp-check.mjs`: PASS, 5 test.
- `cargo test --manifest-path src-tauri/Cargo.toml --offline`: PASS, 90 test.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --offline --all-targets -- -D warnings`: PASS.
- `cargo build --manifest-path src-tauri/Cargo.toml --offline`: PASS, desktop debug.
- React Doctor changed: 82/100, nessun rilievo nuovo (non un audit completo).
- App debug Windows + processo Node MCP reale, profilo sintetico separato: PASS
  avvio ordinario senza bridge, catalogo, creazione sessione/appunto UTF-8,
  revisione superata e AI negate, persistenza dopo arresto forzato/riavvio,
  rotazione credenziale e scrittura rifiutata nella modalità di sola lettura.
- Backup `.nodex` reale e ripristino con bridge attivo: PASS nei test Rust;
  le scritture successive usano il nuovo Store, credenziale assente dallo ZIP.

Limiti: la chiusura grafica automatizzata del desktop debug non ha terminato il
processo entro 15 secondi anche senza automation; prova non superata, nessuna
attribuzione della causa senza evidenze. I processi sintetici sono stati chiusi
in modo forzato. Cleanup/shutdown del bridge verificati nei test Rust, non con
chiusura GUI nativa. Nessuna accettazione macOS/Linux/client MCP terzi. Node va
installato separatamente. Il nuovo errore di conflitto usa fallback italiano.
Nessun installer/release 0.3.0 pubblicato: prima va chiusa la verifica di uscita
nativa, senza presentare una consegna parziale come release verificata.
M11 v0.2.0 conserva la propria bozza e il blocco sugli allegati AI grandi.

Skill usate: rust-best-practices, tauri-v2 e sqlite-expert per servizi locali e
Store condiviso; react-testing/react-doctor per refresh e bozze;
systematic-debugging per distinguere i risultati nativi dai test riusciti.

Prossimo controllo: verificare la chiusura desktop Windows e poi preparare la
distribuzione 0.3.0. M11 resta la milestone aperta di pubblicazione; non sono stati
ripresi gli upload grandi durante questa richiesta. I checkpoint sotto sono storici.

# Stato Chronexus — 24 ottobre 2026

## M12/M13 operative Windows → M11 ripresa sulla rete locale

M12: due draghi SVG, estremi del singolo dado (d100 invertito), replay senza RNG,
skip/movimento ridotto. M13: Espruar/Dethek OFL locali, preferenze v2 compatibili
in lettura v1, pacchetti reversibili versionati e fallback. SQLite 015 invariato.

Verifiche: 127 test frontend, 81 Rust, 2 Node font/licenze e 13 distribuzione PASS;
lint/typecheck/format/clippy/i18n PASS; React Doctor changed 100, detector impeccable
senza rilievi. Desktop isolato: 14 estremi reali, replay, tiri misti, font/fallback,
axe 0; 173 tiri identici dopo chiusura/riavvio e backup/ripristino reale.
Installer Windows 0.2.0 costruito/installato e disinstallato in cartella QA; byte
identici alla build salvo il marcatore ufficiale NSIS. Avvio release sul profilo
personale evitato; avvio/IPC testati nella build debug isolata dello stesso sorgente.

M11: codice e tag v0.2.0 pubblicati (sorgente compilato 43467fb). Bozza release
id 2, non pubblicata. Pacchetto leggero app (29 MiB) caricato, riscaricato e SHA-256
verificato; cinque ZIP AI completi pronti in locale, upload grandi bloccati.
Due tentativi indipendenti falliti: secondo HTTP 502 dopo 297.304.064 byte in
235,52 s; API dichiarano limite 2048 MiB, curl proxy_used=0. Nessuna causa server
inventata: richiesti dettagli/log del gateway all'utente. Accesso autenticato OK.
Ripresa autorizzata dall’utente il 24 ottobre, con trasporto esplicito
http://192.168.162.26:3000. Il precedente stop è superato per questa consegna.
Servizio locale verificato: Forgejo 12.0.4, stesso repository id 13 e stessa
bozza v0.2.0 del sito pubblico. Nessun cambio di origin Git o del tag compilato.
Supporto LAN aggiunto con whitelist esatta, blocco redirect e confronto identità;
18 test distribuzione PASS. Invio/verifica dei cinque allegati mancanti ancora
pendenti; bozza conservata fino al controllo completo. Autenticazione solo in RAM.


Output: installers/Chronexus-0.2.0-Windows-x64-final, sei ZIP (uno solo app più
cinque app/AI), SHA256SUMS.txt e package-report.json. Ollama 0.40.10 e Gemma 4 12B
base pubblici, licenze e checksum; nessun dato privato. AI installata realmente
ed esecuzione ripetuta PASS: cloud disabilitato, risposta italiana, 49/49 layer
principali e 5/5 draft GPU. Pacchetto iniziale fuori limite archiviato in .tools.
Gli strumenti riportano ora anche il codice HTTP del gateway; 13 test release PASS.
M11 resta incompleta fino a upload/download dei cinque ZIP grandi e uscita dalla
bozza. Limiti restanti: firma, macOS/Linux, upgrade personale e revisioni M10.

Skill: find-skills per ricerca strumenti (nessuna installazione necessaria),
frontend-design/impeccable/accessibility per resa e movimento, react-testing e
react-doctor per regressioni, Rust/Tauri e systematic-debugging per persistenza
e distribuzione. Dettagli in I18N.md, DICE.md e releases/v0.2.0.md.
Le sezioni seguenti sono checkpoint precedenti.

## M10 — operativa su Windows; accettazione linguistica e assistiva aperta

- **Impostazioni dell’app → Lingua e scrittura** nel menu sinistro, anche senza
  campagna: scelta immediata e persistente, distinta dalle impostazioni AI della
  campagna. Recupero italiano sempre ordinario, anche con preferenze danneggiate.
- 11 lingue naturali (PT brasiliano, cinese semplificato, ticinese in bozza),
  Klingon e Rihannsu romanizzati con lessico parziale/fallback; Braille italiano
  in sottoinsieme, Morse e SGA Minecraft. 1427 messaggi candidati per catalogo
  naturale, font/dizionari editor locali. Traduzioni non certificate.
- Arabo RTL/bidi, CJK, date/numeri/plurali locali; glifi decorativi con testo
  semantico e laboratorio reversibile. Nomi, documenti, UUID, preset, fonti D&D
  e risposte AI restano originali. JSON preferenze v1 esterno ai backup;
  SQLite **015** e `.nodex` invariati. Nessun archivio personale usato nel QA.
- **113 test frontend e 79 Rust PASS**, clippy -D warnings, lint, typecheck,
  format, i18n:check e build desktop release Windows PASS. React Doctor ultimo
  changed: 68, nessun nuovo rilievo; detector impeccable senza rilievi.
- Desktop con frontend compilato: **13 lingue × 13 viste**, tre scritture,
  testo nascosto semanticamente disponibile, arabo 760×600, riavvio, restore
  015 ed error recovery PASS. Backup creato in DE e ripristinato mantenendo EN;
  JSON globale assente dallo ZIP e dati confrontati invariati. Axe impostazioni
  EN/AR/JA senza violazioni; nessuna certificazione completa di accessibilità.
- Cinque font locali, fallimento reale Monocraft con testo normale leggibile,
  Unicode Markdown/visuale, composizione simulata, ricerca CJK e UUID originario
  PASS. Nessun host remoto nei percorsi QA osservati. Log/schermate in .tools/m10;
  fonti, script, manutenzione e limiti in [I18N.md](I18N.md).

**Avvio**: `./scripts/Dev.ps1 -Task desktop`; eseguibile compilato
`src-tauri/target/release/chronexus.exe`. Installer precedenti non rigenerati.

**Commit di implementazione**: 79376ee (preferenze e cataloghi), af92934 (viste e
scritture), a2d0e1c (correzioni/accettazione). Questo checkpoint è completato dal
commit documentale M10. Nessun push remoto.

**Skill usate**: impeccable e accessibility per leggibilità/RTL/testo semantico;
react-testing e webapp-testing per comportamento e collaudi Playwright del
progetto; Rust/Tauri/SQLite per preferenze atomiche separate dai dati;
systematic-debugging e react-doctor per regressioni e verifiche.

**Limiti aperti (5)**: revisione madrelingua/ticinese e lessici inventati parziali;
IME OS e assistive fisiche non provati; macOS/Linux e distribuzione ancora da
validare; font aggiuntivi circa 40 MB e avviso dimensione editor; debito React
preesistente su complessità/componenti grandi, senza nuovi rilievi nei cambiamenti.

**Nuova pianificazione — 24 ottobre 2026**: ordine invertito su richiesta:
M11 release versionate e pacchetti app/AI su Forgegit; M12 draghi animati per
esiti estremi di un solo dado (d100 invertito); M13 alfabeti Elfico/Dethek.
Nessuna delle tre è implementata; restano aperte le revisioni M10 già indicate.

**Prossimo passo funzionale pianificato**: M11, verificando capacità del server,
versionamento e pacchetti prima di realizzare il rilascio. La presente richiesta
scambia soltanto le milestone: non implementare o pubblicare ora.

**Pubblicazione**: origin verificato `https://github.com/Acelith/Chronexus.git`.
Registrata istruzione permanente per pubblicare future consegne di milestone
verificate con release/pacchetti versionati, salvo divieto successivo. **Nessuna
pubblicazione in questa esecuzione**, inclusi push, tag remoti, release e upload.
Modificate soltanto roadmap/specifiche/guide. Skill disponibili valutate: nessuna
specializzazione richiede applicazione per questa modifica documentale.
Verifiche di questa richiesta: diff e coerenza requisiti; nessun test applicativo,
nessuna build e nessuna verifica di nuove funzionalità dichiarata.

Le sezioni seguenti conservano i checkpoint precedenti e il percorso di verifica.

## M9 — operativa e collaudata su Windows

- Tiradadi da menu sinistro: d4/d6/d8/d10/d12/d20/d100, composizioni miste,
  quantità da 0 a 50 per tipo e 1–100 dadi per tiro. Azzeramento solo dopo
  conferma; errori conservano selezione e ID per retry senza duplicazioni.
- Storico per campagna in SQLite 015: valori, subtotali, totale, data, UUID e
  paginazione a 30. CSPRNG del sistema operativo e rejection sampling nel Rust;
  risultati salvati prima della scena e invariati dopo skip o cambio vista.
- Draghi/texture/fuoco originali locali, geometrie e cifre renderizzate dal codice;
  sequenza di 2,5 secondi, slot, skip e movimento ridotto. Al massimo 14 dadi
  rappresentativi nella scena, tutti i valori nei dettagli e nello storico.
  Il totale del nuovo tiro non viene anticipato nello storico durante la sequenza.
- 85 test frontend PASS (12 nuovi), 77 Rust PASS (8 nuovi); clippy -D warnings,
  lint, typecheck, format e build desktop Windows PASS. React Doctor: nessun
  problema nei cambiamenti, 74/100 invariato; detector impeccable: nessun rilievo.
- Native check: tutti i tipi, d100, tiri misti e 100 dadi, valori confrontati con
  SQLite, retry, interruzione, skip/reduced, isolamento e storico su 187 tiri
  sintetici PASS. Tempi misurati 2528/2520/2524 ms per 1/7/100 dadi. Nessuna
  richiesta Internet al tiro con richieste remote bloccate; IPC locale ammesso.
- Backup/ripristino UI ed export JSON 015 PASS; chiusura e riavvio dopo ripristino
  PASS con risultati identici. Archivio 014 migrato senza perdita coperto da Rust.
  Frecce/Tab/Shift+Tab/Enter/doppio Enter e dettagli da tastiera PASS; un solo
  tiro per invio doppio. Screenshot separati con fixture esplicita per 6/9/100.
- Axe WCAG A/AA su scena vuota e risultato: zero violazioni rilevate; verifica
  visuale/tastiera completata, senza dichiarare certificazione o prova con NVDA.
  Finestre 1586×992/1200×800/900×700/760×540 senza overflow della finestra.
- Rapporti/screenshot e archivi sintetici: .tools/m9 (ignorati). Campagne personali
  non modificate. macOS/Linux, installer aggiornati e prova fisica offline non
  eseguiti; warning Vite preesistente sul peso del chunk editor. Nessun push.
- Commit: 3b0e2ac backend/migrazione; 7aed999 UI/scena; 5fba9fc rivelazione e
  fixture grafica. Checkpoint finale nel successivo commit documentale.
- Skill: rust-best-practices/sqlite-expert/tauri-v2 per dati e IPC;
  impeccable/imagegen per grafica; react-testing/accessibility per collaudi;
  systematic-debugging/react-doctor per correzioni. Prossima funzione: M10.

## Editor visuale/Markdown e collaudo finale — 24 ottobre 2026

- Barra persistente con stili, titoli, citazioni, elenchi/attività, evidenziazione,
  allineamento, link esterni e pagine Codex, annulla/ripeti. Modalità Markdown
  direttamente modificabile, applicazione, annullamento e salvataggio espliciti.
- Guard di navigazione/chiusura include il sorgente. Sintassi non supportata o
  link non validi mantengono la bozza; UUID e ID/fonti dei blocchi invariati
  conservati. Formati visuali dei blocchi invariati conservati nel round trip.
- Test: 73 frontend PASS; baseline 69 Rust PASS dalla nuova posizione (nessuna
  modifica Rust/schema). Typecheck, lint, format e build frontend PASS.
  Build desktop Windows da D PASS; ricostruzione finale dopo il refactoring
  verificata nel commit di consolidamento. Warning Vite sul chunk editor ancora presente.
- Prova desktop ripetibile `scripts/qa/gui-editor.mjs check`: PASS su archivio
  sintetico isolato; scroll a tre risoluzioni, formati, menzioni UUID, errori
  bloccanti e menu impostazioni. Chiusura ordinata e nuova apertura dello stesso
  archivio: fase `restart` PASS, contenuti e formati recuperati da SQLite.
- Riparazione AI: Python della venv su D/CUDA disponibili; Ollama avviato da D,
  Gemma 4 12B risponde «OK» con VRAM rilevata. Nessun nuovo training eseguito.
- Guide: `docs/EDITOR.md`; schema JSON v1 e SQLite 014 invariati; nessuna
  campagna personale modificata. Il Markdown non rappresenta tutti i formati Word:
  tabelle, HTML, immagini e blocchi di codice sono esplicitamente rifiutati.
- Skill: react-testing, systematic-debugging, react-doctor per controlli e correzioni;
  impeccable per il detector finale (nessun pattern segnalato dopo la correzione).
- Commit GUI: d5b07a1; disposizione grafo: f8d6b68; spostamento: 313e056.
  Editor: 64d65c6; M10 nel successivo commit documentale. Nessun push.
- React Doctor finale sui nuovi file inclusi: 74/100, invariato rispetto alla
  prima scansione; un avviso residuo di complessità nel componente editor.
  Nessun errore lint/types; detector impeccable finale: array vuoto.

## GUI di riferimento e navigazione — 24 ottobre 2026

- Ripresa la composizione allegata: cuoio scuro, pergamena, font locali OFL,
  rosa dei venti, incisione originale, tab con icone e dettaglio laterale del grafo.
  Le illustrazioni dei personaggi dipendono dagli allegati reali; nessun dato
  dell’esempio inserito negli archivi personali. La corrispondenza pixel per pixel
  con l’immagine non è certificata: icone, incisione e geometria dei dati sono originali.
- Impostazioni della campagna e assistente nel menu sinistro. Menu azioni compatto,
  selettore campagne e ultima modifica derivata dai documenti disponibili.
- Diario e Codex: elenco e documento scorrono indipendentemente dalla cornice;
  vecchia regola mobile orizzontale rimossa anche alla dimensione minima.
- Grafo con nodi a medaglione, etichette visibili, disposizione stabile con
  riduzione degli incroci su piccoli grafi (coppie duplicate escluse), zoom,
  filtri avanzati e fonti/certezze mantenuti. Ritratto reale nel dettaglio, se allegato.
- Verifiche: 14 test mirati App/grafo PASS; typecheck e lint PASS; build frontend
  PASS (warning preesistente sul peso dell’editor). Prove native con fixture isolate
  a 1586×992, 900×700 e 760×540: nessun overflow della finestra, liste verticali
  indipendenti e font locali caricati. Screenshot e rapporti in .tools/ui-refresh/.
- Skill: impeccable per confronto e rilevamento finale; imagegen per materiali e
  incisione offline; react-testing per regressioni; react-doctor per diagnosi React.
  Editor consolidato nella sezione precedente; multilingua pianificato come M10.

## Riparazione dopo spostamento su D — 24 ottobre 2026

- Collegamenti node_modules ricreati con lockfile invariato: i precedenti
  puntavano a C. Store relativo in pnpm-workspace.yaml e launcher Dev.ps1.
- Baseline dalla nuova posizione: 59 test frontend e 69 Rust PASS;
  typecheck e Vite 8.3.5 PASS. Python della venv su D importa PyTorch
  2.14.1+cu130, CUDA disponibile. Nessuna campagna personale modificata.
- Skill: systematic-debugging per la causa dei collegamenti rotti; tauri-v2
  per la verifica della toolchain portatile. Rifacimento GUI/editor in corso.

## Milestone e prossimo passo

M7 operativa e collaudata su Windows: assistente locale con fonti, GPU e cronologia.
**Accettazione completa ancora parziale**: manca la prova con rete fisicamente
scollegata/blocco firewall. La prova proxy e le connessioni loopback sono distinte.
Restano inoltre M6 macOS/Linux/CI reali e revisione del wizard Windows interattivo.
M8 operativa e collaudata su Windows: Gemma 4 12B locale, impostazioni per
campagna (013), QLoRA reale e adapter con backup/ripristino (014). Accettazione
sulle altre piattaforme e prova fisica offline/firewall ancora pendenti.
**M9 consegnata su Windows. Prossima milestone funzionale: M10 — Multilingua.**
M10 aggiunta alla roadmap: tutte le 16 lingue/modalità richieste, RTL, CJK,
accessibilità Braille, Morse e alfabeti di fantasia; solo pianificazione,
nessuna localizzazione implementata in questo intervento.
Nessun push autorizzato o eseguito.

Il modello specifico D&D 1.5B è stato provato su GPU e scartato per qualità.
L'utente ha approvato esplicitamente Qwen3:4b-instruct multilingue con fonti locali,
**non fine-tuned D&D**. Setup e identità verificabili: [AI_LOCAL.md](AI_LOCAL.md).

## Verifiche effettive M8

- 69 test Rust e clippy offline con `-D warnings`: PASS. 59 test frontend:
  PASS; ultimi ritocchi coperti anche da 7 test mirati dell'assistente.
  Lint, typecheck, format e build frontend: PASS. Worker Python: 5 PASS.
- `pnpm build:desktop` e `pnpm package:desktop`: PASS; installer NSIS Windows
  non firmato generato. Installazione M8 non ripetuta, non confonderla con M6.
- GPU RTX 4080 SUPER 16 GB: 4 casi Qwen e 4 Gemma con esito atteso nell'app.
  Training dal menu su 4 estratti/8 passaggi e successiva prova su 74 estratti,
  74 esempi/74 passaggi: pesi modificati, copertura completa, tre controlli di
  citazioni/assenze/GPU, attivazione e domanda sull'ultima fonte PASS.
  Picco PyTorch: 11.705.906.688 byte (circa 10,9 GiB).
- Annullamento reale dopo il primo passaggio GPU: PASS, modello attivo invariato.
  Riavvio, backup/restore nativo, rimozione del solo modello sintetico e sua
  ricostruzione dall'adapter senza nuovo training: PASS; citazioni ancora valide.
- Regole sintetiche 2014/2024 separate, edizione errata respinta, fonte malevola
  esclusa dalle risposte e bloccante per training, esclusione esplicita: PASS.
  Ollama realmente spento: errore utile e `sentToModel=false`; runtime riavviato.
- Backend Python/CUDA e checkpoint verificati anche nel percorso standard
  `%APPDATA%/it.nodex.desktop/ai-training`. Campagne personali non modificate.
  Runtime e checkpoint fuori dagli archivi; adapter compatti inclusi e verificati.
- Script ripetibile con fixture sintetiche: `scripts/qa/m8-local-ai.mjs`;
  originali dei rapporti in `.tools/m8/`, ignorati. La fase boundaries del
  nuovo harness è stata rieseguita; seed/train/recover/coverage derivano dagli
  stessi scenari nativi eseguiti prima del consolidamento, senza un secondo
  giro completo del nuovo harness. Modelli derivati temporanei rimossi dopo
  importazione/collaudo; nessun test fisico offline o guasto hardware simulato
  presentato come verifica reale. CUDA assente coperta da test controllato.
- Commit: a99355e impostazioni; 1fde390 training; 4d007f1 copertura completa.
  Guide e collaudo consolidato nel commit successivo. Nessun push.

## Funziona

- M0–M6: campagne e diario/autosave, Codex UUID/backlink, relazioni con fonte e
  certezza, scheda estesa, inventario/incantesimi, FTS5, dashboard, immagini gestite
  incluse nei backup, export Markdown/JSON e originali Logseq immutabili.
- Tema pergamena/cuoio/ottone, grafo ordinato/organico con filtri e dettaglio;
  Party sulle pagine Codex; Wiki Open5e multi-fonte con cache offline.
- Assistente facoltativo, disattivato inizialmente: adapter Rust su loopback fisso,
  cloud disabilitato verificato, identità GGUF/digest, preflight GPU prima degli
  appunti. Nessun download, inferenza all'avvio, cloud fallback o tool del modello.
- Retrieval lessicale per sola campagna e regole cache scelte per edizione;
  estratti limitati con ID/blocco/revisione/hash. Fonti riapribili con avviso di
  modifica/mancanza; affermazioni dei PNG non promosse automaticamente a fatti.
- Streaming, cancellazione anche durante la risposta, bozze persistenti e recovery.
  Cronologia paginata, cancellazione confermata, backup/export di conversazioni
  e fonti; runtime/pesi esclusi. Nessuna scrittura implicita in note/grafo/scheda.
- Gate prudente esclude estratti con possibili istruzioni al modello. Se tutti
  sono sospetti ferma la richiesta e conserva le copie per revisione.
- Schema M7 **012 additivo**; vecchi backup migrati in copia, nuovi richiedono versione
  compatibile. Identificatori legacy it.nodex.desktop/nodex.sqlite3/.nodex mantenuti.

## Verifiche effettive M7

- `cargo test --offline --manifest-path src-tauri/Cargo.toml`: **63 PASS**.
- `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`:
  PASS. Build debug: PASS.
- `pnpm test`: **55 PASS / 19 file**; ultimi ritocchi verificati anche con i 3
  test mirati dell'assistente. Lint, typecheck, format:check: PASS.
- `pnpm package:desktop`: PASS, installer Windows NSIS non firmato. L'installazione
  M7 non è stata ripetuta; installazione/avvio/rimozione M6 erano stati verificati
  preservando due DB personali con SHA-256 identico.
- GPU reale: Ollama 0.40.10, Qwen3:4b-instruct Q4_K_M, contesto 8192, **3539 MiB
  interamente in VRAM** sulla RTX 4080 SUPER. Le prestazioni dipendono dal carico.
- Benchmark finale **40/40 esiti attesi**: 20 campagna, 10 regole originali di
  prova in conflitto fra edizioni, 5 assenze con inferenza GPU; 5 attacchi bloccati
  prima del modello. Dati canonici invariati. Non è accuratezza universale.
- Prove native: streaming, annullamento dopo token GPU con bozza non vuota,
  navigazione, blocco citato, rinomina, regole 2024, delete, backup/export: PASS.
- Ripristino e secondo riavvio senza Ollama: identiche **90 conversazioni/fonti/
  metriche, 25 pagine, un membro Party e configurazione**. Immagine originale
  inclusa nel backup/export. Nessuna campagna di prova nel profilo personale.
- Errori di protocollo nativi simulati: cloud attivo, modello mancante, CPU,
  OOM, stream incompleto/malformato/eccessivo, citazione inventata; nessun invio
  appunti nei primi quattro casi. Runtime realmente assente: errore conservato.
- Cloud disabilitato + proxy esterni non raggiungibili: inferenza reale riuscita;
  **80 campioni, 173 connessioni del runtime/esecutore, solo 127.0.0.1**.
  Non è una prova fisica offline o una verifica firewall. Nessun guasto GPU provocato.

## Campagna privata preesistente

Speratia M6: 84 sessioni, 209 pagine, 18 asset, 36 immagini, 207 Markdown originali.
Backup schema 009 verificato nella build 011 durante M6; UUID/checksum preservati.
Trascrizione Oran parziale; PF attuali illeggibili segnalati, da aggiornare.
Backup già consegnato: C:/Users/Joel/Downloads/Speratia_Chronexus_M6_2026-10-23.nodex
(52.321.017 byte), SHA-256
58a3e5fdc05670b46536c911eb92e5c83d7b8f86b5721c3c3adda5b893fd714c.
Ripristino sostituisce l'intero archivio con copia preventiva, non fonde campagne.
Archivi/foto/DB/profili/modelli restano fuori Git; nessun dato privato pubblicato.

## Commit M7

- e6f1763 feat(ai): integra inferenza GPU locale e conversazioni persistenti
- a89874e fix(ai): evita prove duplicate e recupera i ruoli del party
- d63ba16 fix(ai): restringe le fonti ai nomi presenti nella domanda
- cf39425 fix(ai): esclude istruzioni sospette prima dell inferenza
- 4ac9f7f feat(ai): aggiunge interfaccia assistente e avvio locale
- Guide e checkpoint finale: vedere l'ultimo commit Git.

## Avvio, Skill e limiti

Installer app M8 nella root: `installers/Chronexus-M8-Windows-x64/`.
Il precedente `Chronexus-0.1.0-Windows-x64/` contiene la distribuzione M7 e il
suo runtime Qwen; non è stato sovrascritto. Il nuovo installer app non incorpora
il checkpoint Google da 24 GB o l'ambiente QLoRA. Su questa macchina il backend
è già preparato; per altri computer seguire [AI_TRAINING.md](AI_TRAINING.md).

Avvio: `powershell -File scripts/Start-LocalAI.ps1`, poi il nuovo Chronexus
oppure `pnpm desktop` nell'ambiente Rust configurato. Campagna → Impostazioni
della campagna → Controlla Ollama → gemma4:12b → conferma multilingue → Attiva.
Riaddestra sui nuovi dati e Attiva adapter sono due azioni distinte.
Dettagli installer e limiti: [INSTALLERS.md](INSTALLERS.md).

Skill M8 letta/applicata: **vercel-react-best-practices**, per caricamento
condizionale, richieste locali indipendenti, progresso e recupero degli errori.
Non sono state applicate Skill AI/database assenti dal catalogo.

Skill M7 effettivamente letta/applicata: **vercel-react-best-practices**, per
caricamento differito, richieste indipendenti e aggiornamenti dello streaming.
Il tema esistente è mantenuto; nessuna nuova Skill AI/Rust/database disponibile
applicata. Ricerca Skill/design M6 già documentata in RESEARCH_DND.md.

Limiti: citazioni controllate strutturalmente, non verità semantica; modello
prolisso e non esperto D&D addestrato ad hoc; gate lessicale con possibili falsi
positivi/attacchi nuovi. Retrieval a estratti, non intera campagna o embeddings.
Wiki principalmente inglese/cache espellibile; un solo PG giocabile, Party in Codex;
bundle editor grande, backup manuali. Prossime verifiche: offline fisico M7 e
attività residue M6 macOS/Linux/CI e wizard Windows. Vedere ROADMAP.md.
## M10 in corso — fondazioni linguistiche

Preferenze globali versionate in `interface-preferences.json`, indipendenti dal
backup delle campagne e senza migrazione SQLite (015 invariata). Menù globale
Lingua e scrittura disponibile anche senza campagna; cambio senza riavvio,
ripristino italiano, fallback e isolamento bidirezionale. Cataloghi in preparazione:
le traduzioni automatiche non sono revisioni linguistiche. Nessun dato di campagna
viene inviato al modello: la preparazione locale legge soltanto stringhe UI.

Verifiche fondazioni: 3 test frontend e 4 test Rust selezionati superati;
TypeScript e lint superati dopo correzione del pattern degli errori.
React Doctor: 84, nessuna regressione rispetto al riferimento 74 della M9.
Skill: accessibility, react-testing, impeccable per impostazioni e testo semantico;
Rust/SQLite/Tauri per preferenze locali atomiche, senza cambiare i dati salvati.
Restano da completare integrazione di tutte le viste, trascrizioni, cataloghi,
collaudo desktop e documentazione definitiva.
### M10 — integrazione verificata, collaudo desktop in corso

Collegate le viste ai cataloghi: 1429 messaggi candidati per ciascuna lingua
naturale, fallback italiano, dizionari BlockNote locali, date/numeri locali,
plurali della ricerca e font offline arabi/CJK. Le traduzioni sono bozze:
corretti termini portoghesi rimasti in inglese; cinese normalizzato con OpenCC.
Klingon/Rihannsu: solo lessico verificato e italiano per il resto; glossario con
grafia romanizzata. Braille italiano a sei punti in sottoinsieme letterario,
Morse e SGA Minecraft/Monocraft: etichette decorative con testo semantico,
laboratorio reversibile e recupero italiano. Nessuna conversione degli appunti.

Controlli eseguiti: 113 test frontend superati, TypeScript e lint superati.
React Doctor corrente: 63 e nessun nuovo rilievo nelle modifiche; confronto
ripetuto con lo stesso strumento sul commit M9 6ef5222: 61. I punteggi storici
74/84 non sono comparabili con questa esecuzione/versione. Risolte le nuove
segnalazioni su formatter e componenti, separando dialogo backup, immagini e job.
Il dialogo backup usa ora dialog nativo; jsdom richiede uno shim nel solo test.
Prime prove desktop: 13 lingue × 13 viste e axe EN/AR/JA senza violazioni rilevate.
Da terminare: trascrizioni native, riavvio, ripristino, font/IME e build finale.
Skill aggiunte alla verifica: systematic-debugging e react-doctor per regressioni;
webapp-testing per ricognizione e prove browser, usando il runner Playwright JS
esistente nel progetto. Revisione linguistica e prova assistiva reale non eseguite.
### M10 — correzioni di accettazione e prove finali

Corrette etichette principali e conteggi (fra cui Oggetti in tedesco), aggiunto
lessico editoriale ripetibile in core-labels.json, normalizzazione/pruning
cataloghi, frasi intere nella conferma restore e traduzione di stati backup/export
e diagnostici pubblici conosciuti. Corretto il CSS del testo semantico nascosto:
la scelta «solo trascrizione» funziona, conservando il nome accessibile.
Dialogo restore centrato, scorrevole e leggibile nella finestra minima.

Prove: 113 frontend e 79 Rust PASS; typecheck/lint/format e clippy PASS;
cataloghi 1427 chiavi naturali con parametri integri; React Doctor ultimo 68,
nessun nuovo rilievo sulle modifiche (baseline M9 ripetuta: 61).
Detector impeccable eseguito: nessun rilievo. Build desktop release PASS.
Native su frontend compilato: matrice 13×13 PASS, tre trascrizioni e testo
semantico nascosto PASS; axe impostazioni EN/AR/JA senza violazioni. Riavvio,
backup/restore 015, Escape/focus del dialogo, preferenze corrotte recuperabili
PASS. Backup creato in DE e ripristinato mantenendo EN: preferenza realmente
esterna al backup; verificata anche l’assenza del JSON nell’archivio ZIP.
Cinque font locali e Monocraft assente, Unicode Markdown/visuale, composizione
simulata, ricerca CJK e UUID del primo blocco PASS. IME OS reale non provato.
Nessuna campagna reale aperta e nessun host remoto contattato nei percorsi QA.
Dettagli, script e limiti: docs/I18N.md. Revisione linguistica/assistiva aperta.

M13 implementata: Espruar/Dethek con font originali OFL, fallback semantico,
preferenze v2 compatibili in lettura v1 e pacchetti reversibili versionati.
37 test mirati frontend + 2 Node font/licenze + 6 Rust preferenze PASS;
typecheck/lint PASS; React Doctor changed 100/100. QA nativo/distribuzione pendenti.
Il refactor aggiuntivo DiceSceneFeedback risolve il rilievo rimasto nel commit M12:
la prima estrazione DiceCast, da sola, non era stata sufficiente.

M11 finale: i cinque ZIP validi sono in installers/Chronexus-0.2.0-Windows-x64-final;
core 1972,7 MiB, volumi 1800/1800/1800/1806,4 MiB, tutti sotto il limite 2048.
Installazione AI reale e ripetuta PASS, nessuna sovrascrittura. La vecchia prova
fuori limite è archiviata sotto .tools, esclusa dalla consegna. Pubblicazione
remota ancora da eseguire e verificare; non dichiarata conclusa in questo commit.
