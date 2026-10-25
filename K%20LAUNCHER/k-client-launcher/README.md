# K Client Launcher (Windows starter)

Tämä on Electronilla tehty K Client Launcherin lähdekoodiprojekti. Se sisältää violetin desktop-käyttöliittymän, PLAY-painikkeen, versio-/profiilivalinnan, asetusten tallennuksen sekä linkit viralliseen Microsoft/Minecraft-kirjautumiseen ja Fabric-asentimeen.

## Tärkeä rajaus
Tämä on käyttöliittymä- ja launcher-integraation aloitusversio, ei vielä itsenäinen Minecraft-käynnistysmoottori. PLAY avaa virallisen Minecraft Launcherin. Minecraftin versio/profiili valitaan siellä; tämän starterin versionvalitsin tallentaa toiveen käyttöliittymään, mutta ei vielä lataa tai käynnistä peliä suoraan. Sisäänrakennettu Microsoft → Xbox Live → Minecraft Services -token-vaihto ja omistusoikeuden tarkistus eivät ole toteutettuja. Salasanoja tai token-arvoja ei kysytä tai tallenneta.

## Tarvitset
- Windows 10/11
- Node.js LTS: https://nodejs.org/
- Virallinen Minecraft Launcher ja Minecraft Java Edition -käyttöoikeus
- Fabric Installer vain, jos haluat Fabric-profiilin

## Käynnistä kehitystilassa
1. Pura ZIP kansioon, esim. `C:\Dev\k-client-launcher`.
2. Avaa kyseinen kansio PowerShellissä.
3. Suorita:
   ```powershell
   npm install
   npm start
   ```

## Rakenna Windows-asennusohjelma
```powershell
npm run dist
```
Asennusohjelma tulee `dist`-kansioon. Testaa se omalla koneella ennen jakamista.

## Käytä
- Asetukset → Valitse tiedosto: valitse virallisen Minecraft Launcherin `.exe`, jos automaattinen avaus ei toimi.
- Microsoft-tili avaa virallisen Minecraft-sivun. Älä syötä salasanaasi mihinkään K Clientin omaan lomakkeeseen.
- Asenna Fabric avaa virallisen Fabric-asentimen sivun. Asenna sama Minecraft-versio Fabricille ja valitse sitten Fabric-profiili virallisessa launcherissa.

## Ominaisuudet, jotka eivät vielä vastaa täyttä OneClientiä
Tämä projekti ei sisällä OneClientin omaa OneConfig/PolyCompose-käyttöliittymää, EvergreenHUD/VanillaHUD-modien omaa toteutusta, SkyBlock-integraatioita, sisäänrakennettua maailmojen hostausta eikä valmista suoraa Minecraft-käynnistysmoottoria. K Client käyttää omaa käyttöliittymää ja avoimesti saatavia yhteensopivia modeja; se ei kopioi OneClientin omaa koodia tai brändiä.

## Seuraavat kehitysvaiheet
1. Rekisteröi Microsoft-sovellus ja toteuta virallinen OAuth 2.0 Authorization Code + PKCE / MSAL -kirjautuminen.
2. Toteuta Xbox Live- ja Minecraft Services -token-vaihto sekä Minecraft-omistusoikeuden tarkistus. Älä ohita käyttöoikeustarkistusta.
3. Käytä Mojangin virallista version manifestia ja Fabricin virallisia metadata-/installer-rajapintoja.
4. Lataa pelitiedostot, tarkista SHA-1-hajautukset ja rakenna oikea Java-käynnistyskomento valitun version manifestista.
5. Lisää virhelogit, päivitykset ja koodin allekirjoitus ennen julkista jakelua.

## Tietoturva
Electronin renderer-prosessissa on `contextIsolation: true`, `nodeIntegration: false`, CSP ja rajattu preload-rajapinta. Älä lisää Microsoft-client secret -arvoa desktop-sovellukseen. Desktop-sovellukset ovat julkisia asiakkaita; käytä PKCE:tä ja virallisia kirjautumiskirjastoja.


## Automaattinen modien asennus

Etusivulla on Modrinthiin perustuva modivalitsin. Se hakee valittuun Minecraft-julkaisuversion sopivia Fabric-modiversioita ja asentaa valitut .jar-tiedostot Windowsin oletuspolkuun `%APPDATA%\.minecraft\mods`. Mukana on kuratoitu valikoima: Sodium, Lithium, FerriteCore, Entity Culling, ImmediatelyFast, Dynamic FPS, ModernFix, Krypton, Noisium, More Culling, BadOptimizations, Enhanced Block Entities, C2ME, Debugify, Zoomify, Xaero's Minimap/World Map, Mod Menu, Fabric API, AppleSkin, BetterF3, Chat Heads, No Chat Reports, Inventory Profiles Next, Iris, LambDynamicLights, Continuity ja ShulkerBoxTooltip. Kaikkia ei valita oletuksena. Modrinth-versio haetaan valitulle Minecraft-versiolle ja Fabric-loaderille; saatavuus vaihtelee. Latauksen SHA-512- tai SHA-1-tarkistussumma tarkistetaan ennen tallennusta.

Käytä ominaisuutta vasta kun Fabric on asennettu samaan Minecraft-versioon. Modit voivat olla eri tavoin yhteensopivia eri peliversioiden ja muiden modien kanssa; asennus ohittaa modit, joille ei löydy sopivaa Fabric-versiota. Olemassa olevia samannimisiä .jar-tiedostoja voidaan korvata, joten varmuuskopioi mods-kansio tarvittaessa. Tämä ei vielä käynnistä peliä suoraan eikä hallitse erillisiä launcher-profiileja.


## Modrinth-haku ja Polyfrost-modit

Modiosiossa voi hakea lisää projekteja suoraan Modrinthistä ja lisätä ne yhdellä klikkauksella asennusvalintaan. Lopuksi painetaan “Lataa ja asenna valitut modit”. Hakutulokset rajoitetaan Modrinthin modiprojekteihin; latausvalinnat tarkistetaan version ja Fabric-loaderin mukaan, ja tiedoston tarkistussumma tarkistetaan ennen asennusta. Valmiissa listassa on myös valikoituja Polyfrostin projekteja, kuten EvergreenHUD, VanillaHUD, PolyBlur, PolySprint, Chatting ja Tooltip Scroll.

OneConfig on nimenomaisesti estetty, eikä sitä asenneta edes automaattisena riippuvuutena. Tämän vuoksi jotkin Polyfrost-modit, jotka tarvitsevat OneConfigin, eivät välttämättä toimi tai niitä ei voi asentaa toimivasti ilman OneConfigia. Polyfrostin koko projektivalikoima ja OneClientin tarkka paketti muuttuvat ajan myötä; listaa ei pidä tulkita taatuksi täydelliseksi kopioksi OneClientistä. Modrinthistä lisättyjen modien käyttöoikeudet, yhteensopivuus ja palvelinsäännöt kannattaa tarkistaa.


## Peliprofiilit (uusi)

Launcherissa on nyt erilliset profiilit:
- Oletusprofiilit `K PvP` ja `K Vanilla`
- Luo omia profiileja, esim. `Dawn PvP` tai `Prism Test`
- Jokaisella profiililla on oma hakemisto ja oma `mods`-kansio käyttäjän K Client -datakansiossa (`profiles/<profiili-id>/mods`)
- Profiilin voi valita Modrinth-modien asennuskohteeksi, avata kansion tai poistaa
- Vanilla-profiiliin ei sallita Fabric-modien asennusta

**Rajoitus:** tämä toteutus eristää profiilien metatiedot ja modit, mutta ei vielä sisällä täyttä Minecraft-instanssin runtimea (versiotiedostot, assetit, kirjastot ja pelin suora käynnistys profiilin hakemistosta). PLAY avaa yhä virallisen Minecraft Launcherin. Profiilikohtainen suora käynnistys vaatii vielä Minecraft-manifestien latauksen, Fabric-profiilin asennuksen sekä virallisen Microsoft/Xbox/Minecraft-tunnistautumisen.


## Java Edition -käynnistys

K Client on tällä hetkellä Java Editionille tarkoitettu launcher-käyttöliittymä, ei valmis itsenäinen pelimoottori. `minecraft://`-URI on poistettu, koska Windows voi ohjata sen Bedrockiin. Aseta Asetuksissa virallisen Minecraft Java Launcher -sovelluksen `.exe`-polku. PLAY avaa tämän launcher-ohjelman; se ei vielä käynnistä valittua K Client/Fabric-profiilia suoraan.
