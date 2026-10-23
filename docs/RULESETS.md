# Adattatori di regolamento

M5 salva valori manuali. `systemId` è un'etichetta libera, non seleziona un motore
di gioco. Scheda, risorse, inventario e capacità rimangono utilizzabili offline
con qualunque etichetta. Nessun testo commerciale è incluso.

Il contratto locale è `RulesetAdapter` in `src/features/player/rulesets.ts`:

- `id`, `label` e `mode` descrivono l'adattatore.
- `derive(character)` è una funzione pura: può proporre statistiche derivate da
  una scheda letta come immutabile. Il risultato è separato dai valori manuali.
- L'unico adattatore disponibile, `generic`, restituisce nessuna derivazione.
  Un identificatore sconosciuto usa lo stesso comportamento manuale.

Per aggiungere un adattatore futuro servono requisiti espliciti del sistema,
licenza delle fonti, test delle formule e registrazione locale nel resolver.
Non introdurre chiamate esterne, sostituzioni silenziose dei valori salvati o
automazioni di riposo/consumo: richiedono un contratto di dominio separato e
azioni dell'utente chiaramente definite. La validazione di persistenza in Rust
rimane obbligatoria anche con un adattatore frontend.

I marcatori conosciuta/preparata sono indipendenti. Non consumano risorse quando
cambiano e non verificano requisiti di classe, livello o preparazione. Risorse e
slot sono contatori configurabili della scheda; PF e contatori usano interi
da zero al massimo scelto, entro il limite tecnico di un milione.

La prima versione gestisce un personaggio per campagna. I suoi UUID e quelli
di statistiche/risorse restano stabili durante le modifiche. Eventuali estensioni
multi-personaggio dovranno migrare il vincolo, preservando proprietà e riferimenti.
