# Fonti D&D e Skill — ricerca del 23 ottobre 2026

## API per la wiki

| Fonte | Verifica | Scelta |
| --- | --- | --- |
| [Open5e v2](https://open5e.com/api-docs/) | API REST pubblica con ricerca trasversale, creature, incantesimi, oggetti e documenti con edizione/editore/licenze | Aggiunta come wiki opzionale; fonte distinta per ogni voce |
| [D&D 5e API](https://docs.dnd5eapi.co/introduction) | Catalogo SRD 2014 già integrato e modificabile nelle importazioni personali | Conservato; nessuna sostituzione degli incantesimi salvati |
| [Wikidot](https://developer.wikidot.com/doc:api) | API XML-RPC autenticata della piattaforma, non un catalogo D&D pubblico equivalente verificato | M16: lettura HTML pubblica di dnd5e.wikidot.com, senza API/chiavi; fonte predefinita |

Prova reale: ricerca `magic missile`, apertura della voce SRD 5.1, documento
`srd-2014`, licenze CC BY 4.0 e OGL dichiarate dall'API. Il catalogo Open5e
comprende materiale di più editori: non significa accesso a tutti i manuali
commerciali o equivalenza integrale con Wikidot. Testo prevalentemente inglese.

La wiki richiede un'azione esplicita. Solo query e ID pubblici vanno all'host
`api.open5e.com`, con GET senza credenziali, redirect vietati, timeout 12 secondi
e limite 2 MiB. Nessun documento della campagna inviato. Cache SQLite massima
100 risposte, inclusa nel backup; vecchi contenuti visibili se il refresh fallisce.
I risultati HTML evidenziati non vengono renderizzati; il testo è escapato.
Consultare regole non crea conoscenze/relazioni nel grafo né sovrascrive incantesimi.

## Ricerca Skill

Consultati [skills.sh](https://skills.sh/) e ricerche CLI
`pnpm dlx skills find "webapp testing"` e `"graph visualization"`.
Nessuna installazione globale; il pacchetto CLI è stato eseguito tramite dlx.

- [webapp-testing di Anthropic](https://skills.sh/anthropics/skills/webapp-testing):
  circa 186 mila installazioni indicate dal catalogo, repository ufficiale
  con circa 183 mila stelle. SKILL.md letto dalla fonte GitHub; workflow Python
  valutato, mentre l'automazione di questa app Tauri resta Playwright JS/CDP già
  in uso. Non dichiarata come nuova Skill installata né come workflow applicato.
- Risultati per grafi AntV G6/React Flow valutati per attinenza: richiedono stack
  diversi da Cytoscape già presente; non adottati solo per il numero di installazioni.
- Skill locali effettivamente lette/applicate: find-skills (ricerca e verifica),
  frontend-design e ui-taste (direzione e critica visuale),
  vercel-react-best-practices (caricamento differito). imagegen usata solo per
  riferimento UI con dati fittizi; nessun dato privato inviato o asset generato
  richiesto a runtime. Documentazione Skill e riferimento restano in .tools/.


## Aggiornamento del 25 ottobre 2026 — Wikidot e nuova M16

La ricerca successiva ha distinto l’API della piattaforma dallo scraping del sito
D&D. [Documentazione XML-RPC](https://developer.wikidot.com/doc:api) e
[metodi](https://www.wikidot.com/doc:api): endpoint autenticato, operazioni
pages.select/get_meta/get_one; nell’indagine già svolta una lettura anonima ha
restituito HTTP 401. Questo non prova se il sito D&D consenta API a un account
specifico, che non è stato verificato con una chiave.

La [pagina pubblica di esempio](https://dnd5e.wikidot.com/spell:acid-splash) è
leggibile via HTML e contiene i campi dell’incantesimo. Il
[robots.txt](https://dnd5e.wikidot.com/robots.txt) consultato nell’indagine non
vietava genericamente quelle pagine; è un’osservazione datata, non un permesso
permanente né una licenza di redistribuzione. Riverificare prima dello sviluppo.

**M16 è solo pianificata:** adapter HTML, selettore Wikidot/Open5e nelle
impostazioni dell’app, Wikidot predefinito, cache offline separata e importazioni
esplicite con provenienza. Nessuna chiave API richiesta dal flusso HTML; nessuna
lettura di contenuti privati o istruzione delle pagine da eseguire.
La versione pubblica 0.4.0 continua a usare Open5e nella Wiki D&D e il catalogo
SRD 2014 separato. Questa consegna non implementa scraping né modifica impostazioni.
Le verifiche citate sopra appartengono all’indagine precedente, non a nuovi test
eseguiti durante il riordino documentale. Criteri completi in ROADMAP.md, M16.


### Verifica di implementazione M16 — 25 ottobre 2026

`robots.txt` ricontrollato: per tutti gli agenti vieta solo percorsi paginati
`/*/p/*` e varianti, e blocca l’agente `voltron`; le pagine usate (`/spells`, `/`,
`/lineage`, `/wondrous-items` e le singole voci) non sono vietate. Il piè di pagina
dichiara «CC BY-SA 3.0 salvo diversa indicazione»: Chronexus mostra questa
dichiarazione per ogni voce senza considerarla una licenza dei contenuti di gioco
degli editori, e non ridistribuisce cataloghi. Il sito ospita regole 2014; le
2024 sono su una wiki separata non usata. Struttura osservata: titolo in
`.page-title`, contenuto in `#page-content`, incantesimi con «Source:», riga
livello/scuola e paragrafo «Casting Time/Range/Components/Duration». Pagine reali
salvate solo in una cartella temporanea per il test QA ignorato, mai in Git.

Aggiornamento dei requisiti M16 (solo pianificazione): cache offline svuotabile
per fonte o interamente, senza cancellare copie importate/dati delle campagne.
Se Wikidot non restituisce informazioni utilizzabili, domanda esplicita prima
del cambio a Open5e e della nuova ricerca; rifiuto/chiusura mantengono Wikidot.
Un cambio accettato viene salvato nelle impostazioni. M15a, annunci epici degli
aggiornamenti, precede ora M16 nell’ordine di esecuzione.
