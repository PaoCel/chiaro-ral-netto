# Chiaro — dal costo azienda alla busta paga

Prototipo realizzato per il task Product Builder di Jet HR.

**[Apri la demo](https://chiaro-ral-netto.paolo-cele.chatgpt.site)**

Calcolatore trasparente per l'anno d'imposta 2026. Da una RAL ricostruisce
le tre grandezze che servono davvero a chi assume e a chi viene assunto:

1. **quanto costa il dipendente all'azienda** (RAL + contributi datore + INAIL + TFR);
2. **quanto arriva netto**, distinto fra mensilità ordinaria e mensilità aggiuntiva;
3. **dove finisce ogni euro trattenuto**, con la norma che lo genera.

Caso modellato: impiegato del settore privato a tempo indeterminato, full time,
residenza fiscale a Milano, unico reddito, nessun familiare a carico né agevolazione.

## Perché non è il solito calcolatore netto/lordo

**Mostra il costo aziendale, non solo il netto.** La RAL è il numero scritto in contratto,
non quello che l'azienda spende. Sopra la RAL ci sono i contributi a carico del datore, il
premio INAIL e la quota di TFR: circa il 37% in più. Il prototipo mostra la catena completa
e il costo di ogni euro netto consegnato al dipendente.

**Il netto mensile non è il netto annuo diviso le mensilità.** Sulla tredicesima non
spettano le detrazioni da lavoro dipendente (rapportate ai giorni dell'anno) e il sostituto
non trattiene le addizionali locali. A parità di lordo, il netto della mensilità aggiuntiva
è più basso di quello ordinario. Su una RAL di 35.000 € la differenza è di circa 395 €, e la
media aritmetica che mostrano i calcolatori semplificati non corrisponde a nessuna busta paga
reale. Il modello distribuisce l'anno su 12 cedolini più le aggiuntive e verifica che la
somma torni esattamente al netto annuo.

**Ogni voce dichiara la propria fonte.** Il registro `SOURCES` in `app/tax-2026.ts` associa a
ciascuna riga del risultato il riferimento normativo e la formula applicata; l'interfaccia
legge da lì, quindi la fonte non può divergere dal calcolo. Il pulsante `fonte` accanto a ogni
importo apre norma e formula.

**Rende visibili i gradini.** La curva dell'aliquota marginale effettiva mostra quanto rende
davvero l'aumento successivo. Emergono due fatti poco intuitivi:

- fra circa 35.200 € e 44.000 € di RAL si azzera l'ulteriore detrazione da 1.000 €, e
  l'aumento rende **meno** che nello scaglione al 43%;
- l'addizionale comunale di Milano è una **soglia di esenzione, non una franchigia**: superati
  23.000 € di imponibile lo 0,8% colpisce l'intero importo. Passando da 25.325 € a 25.350 € di
  RAL il netto annuo **cala di 169 €**, e servono circa 310 € lordi in più per tornare al netto
  di partenza. Il caso è coperto da un test dedicato.

## Struttura

```
app/tax-2026.ts   motore di calcolo e registro delle fonti — nessuna dipendenza da React
app/page.tsx      interfaccia, senza costanti fiscali: consuma solo il risultato strutturato
tests/            test del motore e test di rendering server-side
```

Il grafico è SVG scritto a mano e server-rendered: nessuna libreria di charting.
I pannelli `fonte` usano `<details>`, quindi restano leggibili anche senza JavaScript.

## Modello di calcolo

| Voce | Regola applicata | Riferimento |
| --- | --- | --- |
| Contributi dipendente | 9,19% sulla RAL, +1% sulla quota oltre 56.224 € | L. 335/1995 art. 3-ter, circolare INPS |
| Imponibile fiscale | RAL − contributi obbligatori | TUIR art. 51 c. 2 lett. a |
| IRPEF | 23% fino a 28.000 € · 33% fino a 50.000 € · 43% oltre | TUIR art. 11, L. Bilancio 2026 |
| Detrazione lavoro dipendente | 1.955 € fino a 15.000 €, decalage fino a 50.000 €, +65 € fra 25.000 e 35.000 € | TUIR art. 13 c. 1 |
| Ulteriore detrazione | 1.000 € da 20.000 a 32.000 €, azzerata a 40.000 € | L. 207/2024 art. 1 cc. 6-9 |
| Somma integrativa in busta | 7,1% / 5,3% / 4,8% del reddito fino a 20.000 € | L. 207/2024 art. 1 cc. 4-5 |
| Trattamento integrativo | 1.200 € sotto 15.000 € con verifica di capienza | D.L. 3/2020 art. 1 |
| Addizionale regionale | Lombardia: 1,23% · 1,58% · 1,72% · 1,73% per scaglioni | D.Lgs. 446/1997 art. 50 |
| Addizionale comunale | Milano 0,8%, esente fino a 23.000 € di imponibile | D.Lgs. 360/1998 |
| Contributi datore | 29,4% della RAL (valore tipico del terziario, modificabile) | Aliquote INPS FPLD |
| INAIL | 0,5% della RAL (tasso indicativo per lavoro d'ufficio, modificabile) | D.P.R. 1124/1965 |
| TFR | RAL ÷ 13,5 accantonata ogni anno | Codice civile art. 2120 |

Intervallo supportato: RAL da 15.000 € a 100.000 €.

### Semplificazioni

- le addizionali sono trattenute nell'anno di competenza, non rateizzate su acconto e saldo;
- l'IRPEF è determinata sull'anno intero, senza conguaglio progressivo mese per mese;
- le mensilità aggiuntive sono trattate come ultima fetta di reddito dell'anno, quindi tassate
  all'aliquota marginale;
- premi, straordinari, welfare, fringe benefit e fondi pensione non sono considerati;
- il TFR è mostrato come costo aziendale, senza distinzione fra accantonamento in azienda e
  versamento al Fondo di Tesoreria INPS.

Il risultato è una simulazione informativa: non riproduce un cedolino e non è consulenza fiscale.

## Verifica

```bash
npm test
```

`npm run test:unit` esegue i soli test del motore. Coprono tre livelli:

- **caso di riferimento calcolato a mano**: RAL 35.000 € a Milano, con ogni passaggio derivato
  nel commento del test e confrontato al centesimo;
- **implementazione indipendente**: IRPEF lorda e addizionale regionale ricalcolate con una
  seconda funzione (somma esplicita per scaglione) su tutto l'intervallo, per intercettare
  errori nella funzione progressiva;
- **invarianti su 341 valori di RAL**: identità contabile lordo − trattenute + benefici = netto,
  ricostruzione esatta del netto annuo dai cedolini per 12, 13 e 14 mensilità, assenza di voci
  negative, monotonia del netto con l'unica eccezione documentata della soglia comunale.

Il test di rendering verifica che pagina, fonti normative e grafico SVG siano presenti
nell'HTML servito dal server, non caricati a runtime.

## Avvio locale

```bash
npm install
npm run dev
```

## Fonti

- Ministero del Lavoro — Legge di Bilancio 2026, misure per i lavoratori
- INPS — circolare aliquote contributive 2026
- Regione Lombardia — addizionale regionale IRPEF
- Comune di Milano — addizionale comunale IRPEF
- TUIR (D.P.R. 917/1986) — artt. 11, 13, 51
- L. 207/2024 art. 1 cc. 4-9 — somma integrativa e ulteriore detrazione
