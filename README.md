# Chiaro — RAL al netto

Prototipo realizzato per il task Product Builder di Jet HR.

**[Apri la demo](https://chiaro-ral-netto.paolo-cele.chatgpt.site)**

## Obiettivo

Trasformare una RAL in una stima di netto annuale e mensile mostrando contributi previdenziali, IRPEF, detrazioni e addizionali locali. Il risultato si aggiorna in tempo reale mentre cambia la RAL.

## Modello

Il motore di calcolo è isolato in [`app/tax-2026.ts`](app/tax-2026.ts). L’interfaccia consuma un risultato strutturato, così le regole restano separate dalla presentazione.

Assunzioni principali:

- aliquota contributiva dipendente predefinita: 9,19%;
- aliquota aggiuntiva dell’1% sulla quota oltre 56.224 euro;
- IRPEF 2026: 23%, 33%, 43%;
- addizionale Lombardia progressiva: 1,23%, 1,58%, 1,72%, 1,73%;
- addizionale Milano: 0,8%, esente fino a 23.000 euro di imponibile;
- lavoro per 365 giorni, 13 mensilità e unico reddito;
- intervallo supportato: RAL da 15.000 a 100.000 euro.

Il risultato è una simulazione annuale informativa, non la riproduzione di un cedolino o una consulenza fiscale.

## Avvio locale

```bash
npm install
npm run dev
```

Verifica completa:

```bash
npm test
```

## Fonti

- [Ministero del Lavoro — Legge di Bilancio 2026](https://www.lavoro.gov.it/notizie/pagine/legge-di-bilancio-2026-le-principali-misure-lavoratori-imprese-e-famiglie)
- [INPS — circolare n. 6 del 30 gennaio 2026](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html)
- [Regione Lombardia — addizionale regionale IRPEF](https://www.regione.lombardia.it/bollo-auto-e-tributi-regionali/red-addizionale-regionale-irpef)
- [Comune di Milano — addizionale comunale IRPEF](https://www.comune.milano.it/aree-tematiche/tributi/addizionale-comunale-irpef)

## Limiti

È una simulazione annuale per un caso standard, non la riproduzione di un cedolino né una consulenza fiscale. Non include TFR, premi, straordinari, welfare, fondi pensione, familiari a carico o agevolazioni personali.
