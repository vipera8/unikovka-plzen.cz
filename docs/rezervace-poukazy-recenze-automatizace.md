# Rezervace, poukazy a recenze

Tento dokument popisuje cilovy jednoduchy provozni system bez plneho e-shopu.

## Zakladni tok rezervace

1. Zakaznik vyplni rezervacni formular na webu.
2. Formular se ulozi do Google Sheets jako novy zaznam.
3. Provozovatel zkontroluje termin a rucne nastavi stav `termin potvrzen`.
4. System odesle zakaznikovi platebni udaje.
5. Po prijeti platby provozovatel rucne nastavi stav `zaplaceno`.
6. System priradi pristupovy kod a odesle zakaznikovi instrukce ke hre.

## Zakladni tok darkoveho poukazu

1. Zakaznik objedna poukaz pres formular.
2. Formular se ulozi do Google Sheets jako novy zaznam.
3. System odesle nebo pripravi platebni udaje.
4. Po prijeti platby provozovatel nastavi stav `zaplaceno`.
5. System vygeneruje kod poukazu a odesle elektronicky poukaz.
6. Poukaz plati 12 mesicu od zaplaceni.

## Doporucene stavy v tabulce

- `nova` - poptavka prisla z webu.
- `termin potvrzen` - termin je volny a zakaznikovi se maji poslat platebni udaje.
- `ceka na platbu` - platebni udaje byly odeslany.
- `zaplaceno` - platba byla rucne potvrzena.
- `kod odeslan` - zakaznik dostal pristupovy kod nebo poukaz.
- `odehrano` - hra byla dokoncena.
- `recenze odeslana` - odeslan navazujici e-mail s prosbou o hodnoceni.

## E-mail: potvrzeni prijeti rezervace

Predmet: Rezervace hry Grollova zlata stopa

Dobrý den,

děkujeme za rezervaci hry Grollova zlatá stopa.

Váš požadovaný termín ověříme a brzy vám pošleme potvrzení spolu s platebními údaji. Rezervace bude závazně potvrzena po uhrazení celé ceny hry.

Těšíme se na vás.

Hravá Plzeň

## E-mail: platebni udaje

Predmet: Platební údaje k rezervaci Grollovy zlaté stopy

Dobrý den,

vámi zvolený termín je volný a rezervaci pro vás držíme.

Prosíme o úhradu celé ceny hry bankovním převodem nebo QR platbou.

Cena: {{cena}} Kč
Číslo účtu: {{cislo_uctu}}
Variabilní symbol: {{variabilni_symbol}}
Zpráva pro příjemce: Grollova stopa {{kod_objednavky}}

Po přijetí platby vám pošleme přístupový kód a informace ke startu hry.

Hravá Plzeň

## E-mail: pristupovy kod ke hre

Predmet: Přístupový kód ke hře Grollova zlatá stopa

Dobrý den,

děkujeme za platbu. Vaše hra je připravena.

Přístupový kód: {{pristupovy_kod}}

Hru spustíte na webu:
https://hrava-plzen.cz/#/hra

Start hry: hlavní hala plzeňského vlakového nádraží, u sochy Železničáře.

Nezapomeňte nabitý telefon, mobilní internet, pohodlnou obuv a oblečení podle počasí.

Hravá Plzeň

## E-mail: darkovy poukaz

Predmet: Dárkový poukaz Grollova zlatá stopa

Dobrý den,

děkujeme za platbu. V příloze posíláme elektronický dárkový poukaz na hru Grollova zlatá stopa.

Kód poukazu: {{kod_poukazu}}
Platnost: 12 měsíců od zaplacení

Termín hry si obdarovaný vybere později přes web nebo e-mailem.

Hravá Plzeň

## E-mail: prosba o hodnoceni po hre

Predmet: Jak se vám hrála Grollova zlatá stopa?

Dobrý den,

děkujeme, že jste se vydali po Grollově zlaté stopě.

Pokud se vám hra líbila, budeme moc rádi za krátké pravdivé hodnocení. Pomůže dalším hráčům rozhodnout se, jestli se do hry pustí také.

Odkaz na hodnocení:
{{odkaz_na_hodnoceni}}

Budeme rádi i za jakoukoliv zpětnou vazbu, co zlepšit.

Hravá Plzeň

## Recenze a motivace

Verejne hodnoceni na Google nebo Facebooku musi byt dobrovolne a pravdive. Neni vhodne nabizet darek, slevu nebo vyhodu primo vymenou za verejnou recenzi.

Bezpecnejsi motivace:

- po hre slusne poprosit o pravdive hodnoceni,
- dat QR karticku do batohu,
- pridat tlacitko na konec hry,
- poslat navazujici e-mail,
- nabidnout soutez nebo maly bonus za zaslani interni zpetne vazby nebo fotky, ne za konkretni verejnou recenzi.

## Co je potreba doplnit

- Odkaz na Google hodnoceni.
- Odkaz na Facebook hodnoceni, pokud se bude pouzivat.
- Cislo uctu pro platby.
- Presny text zpravy pro prijemce nebo variabilni symbol.
- Zda ma byt poukaz posilan jako PDF, obrazek PNG, nebo oboji.
- Kolik dni po dohrani ma prijit navazujici e-mail s prosbou o hodnoceni.
