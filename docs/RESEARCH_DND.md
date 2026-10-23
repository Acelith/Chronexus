# Fonti D&D e Skill — ricerca del 23 ottobre 2026

## API per la wiki

| Fonte | Verifica | Scelta |
| --- | --- | --- |
| [Open5e v2](https://open5e.com/api-docs/) | API REST pubblica con ricerca trasversale, creature, incantesimi, oggetti e documenti con edizione/editore/licenze | Aggiunta come wiki opzionale; fonte distinta per ogni voce |
| [D&D 5e API](https://docs.dnd5eapi.co/introduction) | Catalogo SRD 2014 già integrato e modificabile nelle importazioni personali | Conservato; nessuna sostituzione degli incantesimi salvati |
| [Wikidot](https://developer.wikidot.com/doc:api) | API XML-RPC autenticata della piattaforma, non un catalogo D&D pubblico equivalente verificato | Nessuno scraping o accesso autenticato aggiunto |

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
