# Espruar e Dethek — Pixel Sagas / Neale Davidson

Font originali regolari OTF, scaricati dagli archivi dell’autore il 24 ottobre
2026. Gli archivi originali includono OFL 1.1 e Readme: copie presenti accanto a
ciascun font. Non usare le etichette obsolete «personal use» dei mirror come
licenza: fanno fede i file OFL inclusi negli archivi originali qui indicati.

- Espruar: https://www.pixelsagas.com/?download=espruar
- Dethek: https://www.pixelsagas.com/?download=dethek
- Download e SHA-256 in metadata.json.

Nessun file font modificato; alias CSS per integrarli nell’app. Verificato il cmap
OpenType: A–Z e a–z hanno glifi assegnati, 26 glifi distinti per le maiuscole.
Le varianti minuscole/maiuscole appartengono al disegno del font e restano
quelle originali. Legature automatiche disabilitate: resa lettera per lettera,
non traduzione o grammatica elfica/nanica. Cifre e punteggiatura rimangono normali;
unicode-range limita il font a U+0041–005A/U+0061–007A e rende gli altri caratteri
con font ordinari. Non sostituire con rune di altre lingue.

Non esiste in questa implementazione una nuova codifica Unicode degli alfabeti:
il testo della resa usa gli stessi codici ASCII e necessita del font indicato.
Il pacchetto reversibile v2 registra scrittura e alphabetRevision=1, mantenendo
l’originale. Preferenze v1 sono lette e aggiornate in memoria a v2; il file si
aggiorna solo al salvataggio. Vecchie build possono richiedere recupero italiano
per preferenze v2; documenti/SQLite 015/backup non cambiano.
