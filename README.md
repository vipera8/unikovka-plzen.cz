# Grollova zlatá stopa – webová úniková hra

Hotová statická webová/PWA aplikace pro GitHub Pages. Nevyžaduje build krok ani Node.js.

## Rychlé nahrání na GitHub Pages

1. Vytvořte nový repozitář na GitHubu, např. `grollova-cesta`.
2. Nahrajte do něj obsah této složky aplikace, tedy soubory `index.html`, `app.js`, `style.css`, `game-data.js`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, `404.html` a složky `assets/` a `docs/`.
3. V repozitáři otevřete **Settings → Pages**.
4. Source nastavte na **Deploy from a branch**.
5. Branch: `main`, folder: `/root`.
6. Po uložení GitHub zobrazí adresu webu.

Soubor `.nojekyll` je přiložený, aby GitHub Pages nesahal do názvů souborů jako Jekyll.

Vnitřní obrazovky hry používají adresy s `#`, například `#/hra` a `#/hra/app`. Díky tomu hra funguje i na GitHub Pages v repozitáři nebo podsložce, bez lokálního serveru a bez nastavování přepisovacích pravidel.

## Videa

Aplikace očekává videa ve složce:

```text
assets/video/
```

Výchozí názvy:

```text
01.mp4
01b.mp4   druhé video po odemčení deníku na 1. zastávce
02.mp4
03.mp4
...
13.mp4
```

V ZIPu je zatím pouze `demo.mp4`. Pokud konkrétní video ještě neexistuje, aplikace automaticky přehraje `demo.mp4` a zobrazí upozornění, jaký soubor doplnit.

## Audio

Audio soubory „Chci vědět víc“ jsou vložené ve složce:

```text
assets/audio/
```

Pro znělku na 5. zastávce doplňte později:

```text
assets/audio/05_znelka.mp3
```

## Kódy pro odemykání zastávek

Kódy jsou v souboru `game-data.js`. Aplikace ignoruje velikost písmen, mezery a diakritiku.

Vývojový/testovací kód je:

```text
TEST
```

## Admin / test režim

V menu je položka **Admin / test**. Výchozí heslo je:

```text
groll
```

Změníte ho v `game-data.js` v hodnotě `adminPassword`.

Důležité: protože GitHub Pages je statický hosting bez backendu, tato MVP administrace je lokální pouze v konkrétním prohlížeči. Nevidí automaticky jiné telefony/týmy. Pro reálné centrální sledování týmů by bylo potřeba přidat backend/databázi, například Supabase, Firebase, Vercel Functions nebo Netlify Functions.

## Ukládání postupu

Postup hry se ukládá do `localStorage` prohlížeče. Po zavření stránky se tým vrátí tam, kde skončil. Reset lze provést v Admin / test režimu.

## GPS

GPS kontrola je nastavená jako měkký zámek. Když poloha nesedí, hráč může ručně potvrdit, že je na místě. Toto ruční obejití se ukládá do lokálního logu.

## Vlastní doména

Po zprovoznění GitHub Pages můžete v **Settings → Pages → Custom domain** doplnit vlastní doménu a podle instrukcí GitHubu nastavit DNS.


## Verze v9 – obrázky místo videí

Hráčská část nyní na zastávkách zobrazuje statické obrázky v `assets/images/` a úvodní audio je v rozbalovací sekci **Úvod** s přehrávačem a přepisem. Video placeholder `demo.mp4` už se na zastávkách nepoužívá.
