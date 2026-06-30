# Nasazení Google Apps Script backendu

Tento projekt používá GitHub Pages jen pro veřejný web a frontend hry. Tajné části hry musí být v soukromém Google Sheetu, ne ve veřejných souborech webu.

## 1. Google Sheet

Vytvořte nový Google Sheet nebo použijte existující sheet pro monitoring hry.

V Apps Scriptu vložte obsah souboru:

```text
docs/leaderboard-google-apps-script.js
```

Uložte projekt a spusťte funkci `setupSheets`. Poprvé Google požádá o oprávnění.


## 1b. Soukromé nastavení Apps Scriptu

V Apps Scriptu otevřete `Project Settings > Script properties` a nastavte:

```text
ADMIN_PASSWORD=vaše admin heslo
```

Heslo nedávejte do veřejných souborů repozitáře.
## 2. Tajná data zastávek

Do listu `StationSecrets` vložte obsah lokálního souboru:

```text
private/station-secrets.private.csv
```

Složka `private/` je v `.gitignore` a nesmí se publikovat. Sloupce musí zůstat:

```text
stationId,title,unlockCode,hintsJson,solutionJson
```

`unlockCode` u 13. zastávky obsahuje finální slovo.

## 2b. Soukromé obrázky v nápovědách

Obrázky, které prozrazují nápovědu nebo řešení, nahrajte do soukromé složky na Google Drivu. Každý soubor nechte neveřejný.

Do listu `SecretImages` vložte řádky podle lokálního souboru:

```text
private/secret-images-upload-list.csv
```

Do sloupce `driveFileId` doplňte ID souboru z Google Drivu. ID najdete v odkazu na soubor mezi `/d/` a `/view`, případně za `id=`.

Alternativně lze v Apps Scriptu jednorázově spustit lokální soukromý pomocník:

```text
private/upload-secret-images-to-drive.private.gs
```

Tento soubor vytvoří soukromou složku na Google Drivu, nahraje spoiler obrázky a list `SecretImages` vyplní automaticky. Soubor je v `private/`, protože obsahuje vložená obrazová data.

Aplikace bude dál používat stejný vzhled nápověd. Pokud je v `SecretImages` vyplněné `driveFileId`, obrázek se načte přes neveřejný Apps Script. Veřejný soubor v `assets/images` slouží jen jako dočasná záloha během přechodu a po ověření se může smazat.

## 3. Přístupové kódy pro zákazníky

V Google Sheetu je menu `Hravá Plzeň`:

- `Připravit tabulky` založí potřebné listy.
- `Vygenerovat 10 volných kódů` přidá kódy do listu `AccessCodes`.

Kód je platný, pokud má ve sloupci `status` hodnotu:

```text
active
```

Kupujícímu zákazníkovi přiřaďte řádek vyplněním sloupců `customerName`, `email`, `phone`, `orderType`, případně `notes`.

Pro ruční generování přes URL lze použít akci `generateCodes` s admin heslem. Heslo nastavte v Apps Scriptu jako Script Property `ADMIN_PASSWORD`.

```text
?action=generateCodes&adminPassword=VAŠE_ADMIN_HESLO&count=1&customerName=Jan%20Novak&email=jan@example.cz&orderType=rezervace
```

## 4. Formuláře

Formuláře z webu se ukládají do listu `Leads` a zároveň se posílá notifikace na adresu nastavenou v Apps Scriptu:

```js
const LEAD_NOTIFICATION_EMAIL = 'info@unikovka-plzen.cz';
```

Až bude nový e-mail hotový, změňte tuto hodnotu a také veřejný kontakt v `app.js`.

## 5. Nasazení webové aplikace

V Apps Scriptu zvolte:

```text
Deploy > New deployment > Web app
```

Nastavení:

```text
Execute as: Me
Who has access: Anyone
```

Po nasazení zkopírujte URL webové aplikace a vložte ji do `game-data.js` jako:

```js
leaderboardEndpoint
gameMonitorEndpoint
gameBackendEndpoint
```

Všechny tři hodnoty mohou být stejná URL.

## 6. Kontrola před ostrým spuštěním

- `game-data.js` nesmí obsahovat `unlockCode`, `solution`, `hints`, `adminPassword` ani `webAccessCodes`.
- `docs/leaderboard-google-apps-script.js` nesmí obsahovat skutečné kódy zastávek ani řešení.
- Složka `private/` se nesmí nahrát na GitHub.
- Obrázky nápověd a řešení nesmí po finálním ověření zůstat veřejně v `assets/images`.
- Staré veřejné univerzální přístupové kódy už nepoužívejte.

