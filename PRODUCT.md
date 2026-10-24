# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
Desktop Tauri 2 su Windows/macOS/Linux, con interfaccia React locale.
## Users
Giocatore di campagne di ruolo che registra ciò che il proprio personaggio conosce.
## Product Purpose
Scrivere appunti, gestire scheda e ritrovare collegamenti tra sessioni, persone, luoghi e oggetti.
## Capabilities and Constraints
Dati locali SQLite e backup reali; UUID persistenti; menzioni distinte da relazioni dichiarate. Nessuna invenzione di fatti o mutazione implicita degli appunti. Le campagne esistenti vanno preservate.
L'utente richiede GUI fedele al riferimento, impostazioni nel menu sinistro, elenchi a scorrimento indipendente e editor sia visuale sia Markdown. La risposta del 24 ottobre 2026 conferma la modifica diretta del codice Markdown.
## Brand Commitments
Chronexus; interfaccia italiana. L'immagine allegata il 24 ottobre 2026 è l'autorità grafica di questa revisione.
## Evidence on Hand
PROJECT_SPEC.md, ROADMAP.md, implementazione reale e test. Riferimento locale di lavoro: .tools/ui-refresh/reference.png. I nomi esemplificativi della schermata non diventano dati delle campagne.
## Operating Context
Il repository corrente è D:/Development/Chronexus; la copia da C ha richiesto la ricostruzione dei collegamenti delle dipendenze. Il percorso dei dati utente non segue la cartella del codice.
## Product Principles
- Conservare dati e provenienza.
- Consentire azioni comprensibili con mouse e tastiera.
- Rendere evidenti salvataggio ed errori.
- Separare aspetto medievale e comportamento prevedibile.
