# Chiaro — RAL al netto

Prototipo di un calcolatore trasparente dello stipendio netto 2026 per un caso standard: impiegato privato a tempo indeterminato, residente fiscalmente a Milano, senza familiari a carico o agevolazioni.

## Obiettivo

Trasformare una RAL in una stima di netto annuale e mensile mostrando ogni passaggio: contributi previdenziali, IRPEF, detrazioni, addizionale regionale, addizionale comunale e benefici fiscali.

## Modello

Il motore di calcolo è isolato in `app/tax-2026.ts`. L'interfaccia non contiene costanti fiscali e consuma un risultato strutturato, così ogni voce può essere verificata e testata separatamente.

Assunzioni principali:

- aliquota contributiva dipendente predefinita: 9,19%;
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
npm run build
```

## Fonti

- Ministero del Lavoro, Legge di Bilancio 2026
- INPS, valori contributivi 2026
- Regione Lombardia, addizionale regionale IRPEF
- Comune di Milano, addizionale comunale IRPEF
- TUIR, detrazioni per lavoro dipendente
