<div align="center">

<img src="assets/brand/chronexus-wordmark.webp" alt="Chronexus" width="520">

**Il diario del giocatore di ruolo: offline, privato, tutto collegato.**

Annota le sessioni, tieni la scheda del personaggio e ritrova chi ti ha dato quella chiave,
in quale sessione e per quale fazione, senza account e senza cloud.

[![Release](https://img.shields.io/github/v/release/Acelith/Chronexus?label=release&color=6c302b)](https://github.com/Acelith/Chronexus/releases)
[![Licenza](https://img.shields.io/badge/licenza-Apache--2.0-354b3e)](LICENSE)
[![Piattaforma](https://img.shields.io/badge/Windows-x64-241e17)](#download-e-installazione)
[![Offline](https://img.shields.io/badge/dati-solo%20locali-b89b60)](#privacy-e-dati)
[![Lingue](https://img.shields.io/badge/lingue-11%20%2B%20scritture-354b3e)](docs/I18N.md)

[Scarica](#download-e-installazione) · [Funzionalità](#funzionalità) · [Giocare insieme](#giocare-insieme-chronexus-server-facoltativo) · [Wiki](https://github.com/Acelith/Chronexus/blob/main/docs/wiki/Home.md) · [Guida](docs/GUIDE.md) · [Roadmap](ROADMAP.md) · [English](README.md)

<img src="docs/media/hero.webp" alt="Diario di una sessione con appunti, menzioni dei personaggi e barra laterale con il logo dell’araldo" width="900">

</div>

> [!NOTE]
> Ultima release stabile: **[0.11.0](https://github.com/Acelith/Chronexus/releases/tag/v0.11.0)** per Windows x64. L’assistente resta locale per impostazione predefinita; puoi scegliere esplicitamente un server di condivisione compatibile per una campagna. L’installer ha la firma per gli aggiornamenti interni, ma non la firma Windows Authenticode. Per macOS e Linux resta disponibile la [pre-release 0.10.1](https://github.com/Acelith/Chronexus/releases/tag/v0.10.1), senza le modifiche della 0.11.0.

> [!IMPORTANT]
> **Chronexus è interamente vibecoded.** Codice, test e documentazione sono stati scritti
> da agenti di programmazione AI (OpenAI Codex e Claude Code) seguendo le mie istruzioni,
> non a mano. L’ho realizzato solo per un bisogno personale, da giocatore che voleva
> questo strumento, e per curiosità di vedere fin dove gli agenti AI possono spingersi
> nello sviluppo di un software vero. Non c’è un’azienda né uno scopo commerciale. Se
> preferisci evitare software generato con l’AI, consideralo un avviso onesto.
> L’assistente integrato è una funzione separata e facoltativa: è disattivato di
> predefinito e l’app funziona completamente senza.

## Cos’è Chronexus

Chronexus è un’applicazione desktop per chi **gioca** una campagna di ruolo, non
per chi la dirige. Raccoglie in un solo archivio locale il diario delle sessioni, le
pagine su personaggi, luoghi e fazioni, la scheda del personaggio, l’inventario e
gli incantesimi, e collega tutto con riferimenti stabili.

## Perché Chronexus

- **Dalla parte del giocatore.** Ciò che il tuo personaggio sa, sospetta o ha
  sentito dire: niente segreti del master, niente fatti inventati.
- **Una menzione non è un fatto.** Citare due personaggi nella stessa nota non li
  rende alleati: le relazioni le dichiari tu, con fonte e certezza
  (confermata, sospetta, smentita, sconosciuta).
- **I tuoi dati restano tuoi.** Database locale, backup completi in un file
  `.nodex`, nessun account, nessuna telemetria.
- **Pensato per giocare.** Salvataggio automatico, scorciatoie da tastiera, tiradadi
  e scheda a portata di clic durante la sessione.

## Funzionalità

| | Funzione | In breve |
| --- | --- | --- |
| <img src="docs/media/icons/book.svg" alt="" width="24"> | **Diario delle sessioni** | Editor visuale e Markdown, salvataggio automatico, menzioni `[[Nome]]` con collegamenti che sopravvivono alle rinomine |
| <img src="docs/media/icons/books.svg" alt="" width="24"> | **Codex** | Pagine per PNG, luoghi, fazioni, missioni e oggetti, con alias, immagini e collegamenti in entrata |
| <img src="docs/media/icons/graph.svg" alt="" width="24"> | **Grafo delle conoscenze** | Menzioni e relazioni dichiarate distinte, filtri per tipo, certezza e sessione, ritorno alla fonte |
| <img src="docs/media/icons/helmet.svg" alt="" width="24"> | **Scheda, inventario e capacità** | Scheda manuale generica o D&D 5e 2014, provenienza degli oggetti, incantesimi e slot senza formule nascoste |
| <img src="docs/media/icons/dice.svg" alt="" width="24"> | **Tiradadi** | d4–d100 combinati, storico per campagna, cerchio dei draghi animato e movimento ridotto |
| <img src="docs/media/icons/scroll.svg" alt="" width="24"> | **Ricerca** | Testo completo su note, pagine, scheda e oggetti con apertura del blocco trovato (Ctrl/⌘ + K) |
| <img src="docs/media/icons/wiki.svg" alt="" width="24"> | **Wiki D&D** | Wikidot o Open5e su richiesta, copie offline, traduzione locale nella lingua dell’app |
| <img src="docs/media/icons/star.svg" alt="" width="24"> | **Assistente locale (facoltativo)** | Domande sugli appunti con citazioni, su GPU e senza cloud, con Qwen3.8-27B o Gemma 4 12B |
| <img src="docs/media/icons/document.svg" alt="" width="24"> | **Lingue e scritture** | 11 lingue, arabo da destra a sinistra, Braille, Morse, Espruar, Dethek e altre scritture |
| <img src="docs/media/icons/backup.svg" alt="" width="24"> | **Aggiornamenti firmati** | Controllo, download verificato e backup obbligatorio prima di installare, annunciati dall’araldo |
| <img src="docs/media/icons/party.svg" alt="" width="24"> | **Campagne condivise (facoltative)** | Con il tuo [Chronexus Server](#giocare-insieme-chronexus-server-facoltativo): sincronizza i tuoi dispositivi e condividi con il gruppo solo le pagine che scegli |

<details>
<summary><strong>Altre schermate</strong></summary>

<p align="center">
<img src="docs/media/graph.webp" alt="Grafo con relazioni dichiarate e menzioni tra personaggi, luoghi e fazioni" width="440">
<img src="docs/media/character.webp" alt="Scheda del personaggio con caratteristiche, risorse e inventario" width="440">
<img src="docs/media/dice.webp" alt="Tiradadi con il cerchio dei draghi e lo storico dei tiri" width="440">
<img src="docs/media/herald.webp" alt="Annuncio dell’araldo per una nuova versione" width="440">
</p>

<sub>Schermate da una campagna d’esempio inventata; l’annuncio mostra una versione d’esempio.</sub>

</details>

## Download e installazione

| Metodo | Per chi | Come |
| --- | --- | --- |
| **Installer Windows x64** | Tutti | Scarica `Chronexus_<versione>_x64-setup.exe` dall’[ultima release](https://github.com/Acelith/Chronexus/releases) ed eseguilo |
| **macOS, Linux (pre-release 0.10.1)** | Chi vuole provarla | [0.10.1](https://github.com/Acelith/Chronexus/releases/tag/v0.10.1): DMG per Apple Silicon e Intel, `.deb` per ARM64 e x64, AppImage per ARM64 e un installer Windows x64; checksum in `SHA256SUMS.txt` |
| **Aggiornamento dall’app** | Chi ha già la 0.4.0 o successiva | Impostazioni dell’app → Aggiornamenti dell’app |
| **Dal sorgente** | Sviluppatori | Vedi [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |

**Requisiti:** Windows 10/11 x64 con WebView2 (già presente nelle versioni recenti).
Per l’assistente locale facoltativo serve una GPU NVIDIA; da **Impostazioni dell’app → AI
locale: componenti** puoi installare Ollama e il modello senza usare il terminale.

**Primo avvio:** crea una campagna, apri una sessione e scrivi. Digita `[[` per
collegare un personaggio o un luogo, poi esplora **Codex** e **Grafo**.

> [!WARNING]
> L’installer non ha una firma Authenticode di Windows: SmartScreen può chiedere
> conferma. Gli aggiornamenti dall’app sono comunque verificati con una firma
> crittografica dedicata. La [pre-release 0.10.1](https://github.com/Acelith/Chronexus/releases/tag/v0.10.1) non ha nessuna firma e non viene
> proposta dall’aggiornamento interno: al primo avvio usa *Ulteriori informazioni → Esegui
> comunque* su Windows e clic destro → *Apri* su macOS.

## Aggiornamenti e backup

- **Backup e ripristino** crea un file `.nodex` con tutte le campagne e le
  immagini, verificato con SHA-256; il ripristino mostra un’anteprima e conserva
  una copia di sicurezza dei dati attuali.
- **Backup periodici** (Impostazioni dell’app → Backup, disattivati finché non li
  attivi): ogni giorno, ogni settimana o ogni N ore, solo con l’app aperta e
  inattiva, nella cartella `Documenti/Chronexus/Backup periodici` o in una cartella
  scelta da te. Chronexus conserva il numero di copie indicato ed elimina solo le
  copie periodiche che ha creato e registrato.
- Prima di ogni aggiornamento Chronexus crea e verifica un backup completo in
  `Documenti/Chronexus/Backup aggiornamenti` (o nella cartella dati, con avviso, se i
  Documenti non sono utilizzabili): se non riesce, l’installazione si ferma.
- L’araldo annuncia le nuove versioni dopo un controllo leggero all’avvio, che puoi
  disattivare. L’installazione parte solo quando la confermi.

> [!IMPORTANT]
> I backup `.nodex` non sono cifrati. Conservali in un posto sicuro, soprattutto se
> la cartella è sincronizzata con un servizio cloud.

## Assistente locale

Facoltativo e disattivato finché non lo abiliti per una campagna. Risponde in
italiano usando solo gli appunti della campagna e le voci della wiki che approvi,
con citazioni riapribili. Funziona sulla GPU tramite Ollama con il cloud
disattivato e non modifica mai appunti, relazioni o scheda.

> [!NOTE]
> Qwen3.8-27B e Gemma 4 12B sono modelli multilingue, **non** addestrati
> specificamente su D&D: una citazione valida non garantisce che la risposta sia
> corretta. Dettagli in [docs/AI_MODELS.md](docs/AI_MODELS.md).

## Giocare insieme: Chronexus Server (facoltativo)

Chronexus è completo da solo. Quando il gruppo vuole di più, il compagno
**[Chronexus Server](https://github.com/Acelith/Chronexus-Server)** è un piccolo servizio che **ospiti tu**
(un server di casa, un NAS o un VPS economico, con Docker Compose):

- **La tua campagna su ogni dispositivo.** Attiva la sincronizzazione per una
  campagna e ogni salvataggio automatico arriva anche al tuo server. Le modifiche
  fatte offline aspettano e ripartono quando torna la connessione.
- **Condividi solo ciò che scegli.** Ogni pagina, sessione, relazione, membro del
  gruppo, sezione della scheda o immagine resta privata finché non la condividi.
  Il gruppo la vede in sola lettura, con il tuo nome, la fonte e il grado di
  certezza: un'affermazione condivisa non diventa mai un fatto della campagna.
- **Conflitti veri, nessuna sovrascrittura silenziosa.** Se due persone modificano
  lo stesso elemento, entrambe le versioni restano visibili e decidi tu.
- **Account solo su invito, sulla tua infrastruttura.** Ruoli (proprietario,
  giocatore, lettore), dispositivi revocabili, backup del server verificati e
  ripristino.

Collegati da **Impostazioni dell’app → Condivisione delle campagne**, poi scegli cosa
condividere dalla vista **Condivisione** di ogni campagna. Senza server non cambia
nulla: nessun account, nessuna rete, tutto resta in locale.

> [!NOTE]
> Il server è in sviluppo attivo: le funzioni sono implementate e testate nel
> codice sorgente, ma **la release 0.1.1 del server è disponibile su GitHub**; puoi
> compilarlo con Docker Compose seguendo la
> [guida di installazione](https://github.com/Acelith/Chronexus-Server/blob/main/docs/INSTALLATION.md).
> I dati sono protetti da HTTPS ma **non sono cifrati end-to-end**: chi gestisce il
> server può leggere ciò che carichi. L'accesso da Android è pianificato.

## Privacy e dati

- Nessun account, nessuna telemetria, nessun caricamento delle campagne, a meno che
  tu non colleghi il tuo Chronexus Server e scelga cosa inviargli.
- Le uniche richieste di rete partono da un tuo clic (wiki, catalogo SRD,
  aggiornamenti, componenti AI) oppure dal controllo aggiornamenti all’avvio, che
  contatta solo il canale delle release e si può disattivare.
- Le richieste alle wiki contengono solo il termine o la pagina che cerchi.

## Lingue

Italiano (originale), inglese, tedesco, francese, spagnolo, portoghese brasiliano,
giapponese, coreano, cinese semplificato e arabo, più scritture alternative. Le traduzioni sono bozze da revisionare: vedi
[docs/I18N.md](docs/I18N.md). Appunti e fonti non vengono mai tradotti in automatico.

## Roadmap

Le milestone consegnate, quelle aperte e i limiti ancora da verificare sono in
[ROADMAP.md](ROADMAP.md); lo stato dettagliato e le prove eseguite in
[docs/STATUS.md](docs/STATUS.md).

## Sviluppo e contributi

La **[wiki](https://github.com/Acelith/Chronexus/blob/main/docs/wiki/Home.md)** (in inglese) spiega ogni area dell'app per chi gioca e ha una
sezione per sviluppatori (architettura, dati, sincronizzazione, traduzioni, build, QA,
rilasci); i sorgenti sono in [docs/wiki](docs/wiki).

Chronexus è scritto con Tauri 2, Rust, React e TypeScript, con SQLite locale.
Prerequisiti, comandi e verifiche sono in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md);
le regole del progetto in [AGENTS.md](AGENTS.md). Segnalazioni e proposte sono
benvenute nelle [issue](https://github.com/Acelith/Chronexus/issues).

<details>
<summary><strong>Tecnologie</strong></summary>

| Area | Strumenti |
| --- | --- |
| Desktop | Tauri 2, Rust |
| Interfaccia | React 19, TypeScript, Vite, BlockNote, Cytoscape.js |
| Dati | SQLite (rusqlite), backup ZIP con manifest SHA-256 |
| AI locale | Ollama su loopback, Qwen3.8-27B, Gemma 4 12B, QLoRA facoltativo |

</details>

## Crediti e licenze

- Codice di Chronexus: licenza **Apache-2.0**, vedi [LICENSE](LICENSE).
- Font EB Garamond, Cinzel, Noto, Monocraft, Espruar e Dethek: SIL Open Font
  License, testi in [assets/fonts](assets/fonts).
- Catalogo SRD 5.1 di Wizards of the Coast tramite D&D 5e API, sotto CC BY 4.0;
  wiki Open5e con licenze dichiarate per documento; pagine di dnd5e.wikidot.com con
  la licenza indicata da ciascuna pagina. Nessun catalogo è incluso nel programma.
- Logo, illustrazioni dell’araldo e dei draghi: asset originali del progetto, vedi
  [assets/brand](assets/brand/README.md) e [assets/dice](assets/dice/README.md).
- Dipendenze e relative licenze: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

<div align="center">

<img src="assets/brand/chronexus-icon.webp" alt="" width="72">

*Persone, luoghi, idee. Tutto è connesso.*

</div>
