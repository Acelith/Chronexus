# M18 — 0.7.0 locale, canale pubblico invariato

Pacchetto Windows firmato updater compilato e firma reale verificata. L’utente
ha chiesto di lasciare la pubblicazione dopo il rifiuto delle credenziali del
primo push. Nessuna release 0.7.0 creata, canale pubblico ancora 0.6.0;
non proporre la 0.7.0 come aggiornamento pubblicato. Dettagli in INSTALLERS.md.

Schema 018: vecchie scelte Qwen disabilitate senza perdita di cronologia,
citazioni o adapter Gemma. Backup precedenti ripristinabili. Nessun modello è
scaricato dall’updater; preparare il 27B separatamente e attivarlo esplicitamente.
Il flusso firmato M15 e il backup obbligatorio prima dell’installazione restano
invariati. Il checkpoint 0.6.0 sotto è storico; installazione personale non eseguita.

# Aggiornamenti interni — M15

Release corrente: [0.6.0 — M17](https://github.com/Acelith/Chronexus/releases/tag/v0.6.0),
installer Windows x64 firmato e canale pubblico verificato. Schema 017: i backup
pre-installazione includono anche la cache derivata delle traduzioni wiki, senza
cambiare gli originali. Upgrade installato 0.5.0 → 0.6.0 non ancora collaudato;
non confondere la verifica di firma/download con un’installazione reale.

Da Chronexus 0.4.0, **Impostazioni dell’app → Aggiornamenti dell’app** permette di
controllare, scaricare e installare una nuova versione. Il controllo è esplicito:
nessuna richiesta all’avvio, nessun login, nessun invio delle campagne.
Le versioni precedenti richiedono una prima installazione manuale della 0.4.0.

## Flusso e backup obbligatorio

1. **Controlla aggiornamenti** mostra versione e note, oppure un errore utile
   quando il server non è raggiungibile o il canale non è ancora pubblicato.
2. **Scarica aggiornamento** scarica il solo installer dell’app, con avanzamento e
   annullamento. La firma crittografica deve corrispondere alla chiave incorporata
   e alla versione annunciata. Un pacchetto incompleto/manomesso non è installabile.
3. **Crea backup e installa** crea e rilegge un `.nodex` di tutte le campagne,
   immagini/allegati gestiti, fonti e adapter AI inclusi secondo il formato backup
   esistente. Salva anche una ricevuta JSON con SHA-256 e preferenze d’interfaccia/
   aggiornamento. Backup o ricevuta falliti **bloccano** l’installer.
4. Su Windows il componente ufficiale Tauri avvia NSIS in modalità passiva e
   chiude l’app. Riaprire Chronexus al termine. Non viene riattivato implicitamente
   il bridge per assistenti esterni. Su altri sistemi il riavvio è manuale.

Da M16 la ricevuta include anche `wikiPreferences` (fonte wiki scelta), se salvata.

Da M19 i backup si trovano in `Documenti/Chronexus/Backup aggiornamenti`, creata
al primo aggiornamento; la ricevuta include anche `backupPreferences`. Se i
Documenti non esistono, la cartella è un link simbolico/giunzione o un file, o non
è creabile, il backup va nella cartella dati, sottocartella `update-backups`, con
un avviso nell’avanzamento: il backup non viene mai saltato e, se fallisce anche
lì, l’installer non parte. I backup già presenti in `update-backups` restano dove
sono; **Backup e ripristino** li elenca e offre una copia verificata con SHA-256
nei Documenti senza cancellare l’originale. Il percorso compare nelle impostazioni. Hanno nomi unici e non vengono
sovrascritti o eliminati automaticamente. Un nuovo tentativo d’installazione crea
un nuovo backup. I pesi base/runtime AI restano installati separatamente e non
vengono riscaricati né duplicati nel backup. SQLite resta **015**.

Il backup usa lo stesso Store attivo e mantiene il blocco fino alla consegna
all’installer; nessun secondo writer SQLite. AI/addestramento in corso impediscono
l’installazione. Le operazioni dall’interfaccia salvano l’editor prima di partire.
Il collegamento MCP non espone comandi di aggiornamento. I backup precedenti
restano disponibili anche quando l’avvio dell’installer fallisce.

Per recuperare i dati usare **Backup e ripristino** e scegliere il `.nodex` prima
dell’aggiornamento. La ricevuta JSON affiancata conserva separatamente le preferenze
UI; il ripristino `.nodex` continua a mantenere la lingua corrente. Non copiare un
SQLite aperto e non tentare un downgrade automatico dopo migrazioni future.

## Endpoint pubblico Forgegit o server proprio

Endpoint predefinito, senza autenticazione:

```text
https://api.github.com/repos/Acelith/Chronexus/releases/latest
```

Il client legge la release stabile pubblicata, rifiuta bozze/anteprime e richiede
un unico allegato `latest.json`. Scarica il manifesto dall’URL dell’allegato
restituito dall’API e controlla che la versione coincida con il tag della release.
Non usa la rotta GitHub `releases/latest/download`, assente in Forgejo 12.
È possibile configurare anche l’URL diretto di un manifesto Tauri statico.

**Stato del 25 ottobre 2026:** [release 0.4.0 pubblicata](https://github.com/Acelith/Chronexus/releases/tag/v0.4.0),
tre allegati con download anonimi e SHA-256 verificati; API latest e controllo
nell’app funzionanti. L’installer iniziale è disponibile per il bootstrap manuale.

Il repository è stato reso pubblico dall’utente: accesso anonimo verificato con
HTTP 200 e `private:false`. Al momento della prima verifica nessuna release
stabile risultava pubblicata (API latest 404); il repository pubblico da solo non
crea un canale aggiornamenti. Non pubblicare la vecchia bozza incompleta v0.2.0
per far apparire un aggiornamento. Pubblicare la nuova release solo dopo le prove
sull’installer firmato e sui download anonimi.

Sono consentiti HTTPS con certificati validi, senza credenziali/query/frammenti,
e reindirizzamenti sullo stesso origin, massimo cinque. Manifesto massimo 1 MB,
installer massimo 256 MiB; download limitato nel tempo, niente retry automatico.
Nessun header di autenticazione viene generato. Un server alternativo deve usare
la stessa chiave di firma di Chronexus e ospitare anche gli artefatti sul proprio
origin; non basta sostituire l’URL con un pacchetto qualsiasi.

## Compilare e pubblicare aggiornamenti firmati

Si usa `tauri-plugin-updater ~2.14.0` con `requireSignedVersion:true`: la versione
è inclusa nel commento autenticato della firma. La chiave pubblica è nel config
Tauri. La chiave privata è cifrata; la password casuale è protetta da Windows
DPAPI per l’account che l’ha creata. Nessun segreto entra in Git o nei pacchetti.

In questo workspace la coppia protetta è in `.tools/signing/` (ignorata da Git):
`chronexus-update-protected.key`, relativa `.pub` e `password.dpapi`. **Conservarne
una copia sicura e custodire la password in un gestore di password**: DPAPI è
legato ad account/macchina, quindi copiare soltanto il blob su un altro PC non
permette di recuperarlo. Non generare una nuova chiave a ogni build: chi ha già
installato l’app si fida di quella pubblica incorporata. Il wrapper non crea,
ruota o recupera chiavi e non ne stampa il contenuto.

```powershell
# Toolchain Rust disponibile nel PATH; firma in memoria, password mai nei comandi
./scripts/release/Build-SignedUpdate.ps1
```

Output Windows: `src-tauri/target/release/bundle/nsis/` con installer e `.exe.sig`.
La firma updater non è una firma Authenticode Windows. macOS/Linux richiedono
build/verifiche proprie e le firme di distribuzione previste dal sistema.

Generare `latest.json` per il solo target realmente costruito:

```powershell
python scripts/release/updater_manifest.py --version 0.4.0 --target windows-x86_64 --artifact "installers/Chronexus-0.4.0-Windows-x64/Chronexus_0.4.0_x64-setup.exe" --signature "installers/Chronexus-0.4.0-Windows-x64/Chronexus_0.4.0_x64-setup.exe.sig" --base-url "https://github.com/Acelith/Chronexus/releases/download/v0.4.0" --notes docs/releases/v0.4.0.md --output "installers/Chronexus-0.4.0-Windows-x64/latest.json"
```

Il generatore non sostituisce file esistenti e non pubblica nulla. Verificare la
firma del pacchetto reale con il test di integrazione dedicato, normalmente
ignorato perché richiede artefatti locali; poi creare il tag annotato del sorgente
compilato e una nuova release bozza con installer, `.sig` e `latest.json`.
Prima di renderla stabile verificare download e hash; dopo la pubblicazione
verificare anche gli URL anonimi e l’API latest. Non sovrascrivere tag o allegati.

```powershell
$env:CHRONEXUS_QA_UPDATE_MANIFEST = "PERCORSO_ASSOLUTO/latest.json"
$env:CHRONEXUS_QA_UPDATE_PACKAGE = "PERCORSO_ASSOLUTO/Chronexus_0.4.0_x64-setup.exe"
cargo test --manifest-path src-tauri/Cargo.toml --test updater_signature updates_signed_release_package_matches_production_key -- --ignored --exact
```

La CI può costruire pacchetti non firmati per i controlli quando non riceve i
segreti di release; tali pacchetti non devono entrare nel canale updater.
I segreti del runner sono `TAURI_SIGNING_PRIVATE_KEY` e
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, mai variabili del client installato.

## Verifiche e limiti

Test automatici: HTTPS/isolation, discovery Forgejo, dimensioni/annullamento,
controlli crittografici e versione, backup verificato ripristinabile con immagini,
blocco installer dopo errore backup e conservazione dopo errore installer,
stati della schermata e cambio endpoint. Desktop Windows sintetico: impostazioni,
versione, errore HTTP e chiusura ordinaria. Evidenze aggiornate in STATUS.md.
Un aggiornamento reale da una versione pubblica precedente richiede la prima
release firmata e una successiva versione; non confondere questi test con una
prova di upgrade pubblico già eseguita. macOS/Linux e rollback applicativo non
sono certificati da queste prove Windows.

Fonti: [Updater Tauri](https://v2.tauri.app/plugin/updater/) e
[rotte Forgejo 12.0.4](https://codeberg.org/forgejo/forgejo/src/tag/v12.0.4/routers/web/web.go).

Gli installer updater includono direttamente la licenza dell’app e le licenze/
provenienze dei font e degli asset pubblici. Non dipendono da un ZIP esterno per
conservarle durante aggiornamenti successivi.

### Pubblicazione riprendibile dei tre allegati updater

Dopo il test crittografico del pacchetto reale, creare il tag annotato `vVERSIONE`
sul `sourceCommit` di package-report.json e pubblicare main/tag con Git ordinario.
Il publisher controlla albero pulito, origin fisso, identità e permessi, versione,
tag/commit remoto, hash e assenza di modifiche applicative dopo la compilazione.
Non modifica release esistenti non riconosciute dalla sua ricevuta locale.

```powershell
# Accesso di scrittura già configurato in Git per questo preciso repository;
# nessuna scansione di credenziali, file o variabili di altri servizi.
python scripts/release/publish_app_update.py installers/Chronexus-0.4.0-Windows-x64 --git-credentials
# Dopo verifica di tutti e tre gli allegati nella bozza:
python scripts/release/publish_app_update.py installers/Chronexus-0.4.0-Windows-x64 --git-credentials --finalize
```

Senza `--git-credentials` il programma richiede un token nel terminale, senza
echo/salvataggio. Credenziale ordinaria Git usata soltanto sull’origin HTTPS
Forgegit; nessun token nel client installato. La ricevuta locale contiene solo
ID, versione, sorgente e URL degli allegati, e permette la ripresa senza duplicarli.
La finalizzazione verifica anche download anonimi e API latest. Errori mantengono
le prove locali; non cancellare o sovrascrivere la vecchia bozza M11.


### M15a — annuncio dell’araldo (dalla versione successiva alla 0.4.0)

Circa 6 secondi dopo l’avvio Chronexus esegue un controllo automatico leggero:
uno per sessione e al massimo ogni 20 ore, solo verso il canale configurato qui.
Si disattiva con **Controlla una volta all’avvio…**; il pulsante manuale resta.
Se trova una versione più recente compatibile, appena l’app è inattiva compare
l’araldo con il manifesto: **Aggiorna** apre questa sezione e avvia il download
verificato; **Crea backup e installa** resta necessario. **Ricordamelo più tardi**
(o Escape) rimanda di 3 giorni quella versione, **Ignora questa versione** non la
riannuncia. La trombetta si disattiva dall’annuncio o da qui. Preferenze in
`update-announcements.json`, incluse nella ricevuta del backup pre-installazione.
Collaudo: `scripts/qa/m15a-herald.mjs` (vedi docs/QA.md).
