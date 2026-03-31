# Spolupráce s VŠE - webová aplikace pro kategorizaci SCM incidentů

Aplikace slouží k diagnostice výpadků IT systémů v oblasti Supply Chain Management (SCM). Operátor je krok po kroku veden od výběru lokality a skladu, přes identifikaci systému až po diagnostiku konkrétního příznaku. Pro každý identifikovaný incident je v aplikaci zaznamenána řešitelská skupina. V navazující verzi je plánováno rozšíření, kdy aplikace sama vytvoří incident v S3 (nebo již v novém ticketovacím systému).

V aktuální verzi aplikace slouží jen pro prohlížení možných závad, jejich řešení a přiřazené resolver skupiny.

Možné závady a jejich mapování na incidenty a resolver skupiny je do velké míry inspirovaný předchozím mapováním těchto procesů v rámci spolupráve Škoda Auto s VŠE.

## Tech stack

- **Svelte 5** — frontend framework (runes, reaktivita)
- **Vite 7** — build tool a dev server
- **YAML → JSON** — otázky a diagnostické scénáře jsou definovány v YAML souborech, které se při buildu kompilují do JSON (`build.js`, knihovna `js-yaml`)
- **Vanilla CSS** — styly bez preprocesoru

## Nasazení

### Požadavky

- **Node.js** 18 nebo vyšší
- **npm** 9 nebo vyšší
- Webový server (Apache, Nginx, IIS) pro servírování statických souborů

### Postup

1. **Naklonujte repozitář**

   ```bash
   git clone <URL_repozitáře>
   cd skoda_scm_incident
   ```

2. **Nainstalujte závislosti**

   ```bash
   npm install
   ```

3. **Zkompilujte YAML schémata**

   ```bash
   npm run build-schema
   ```

4. **Sestavte produkční build**

   ```bash
   npm run build
   ```

5. **Nasaďte obsah složky `dist/`** na webový server jako statický web (SPA). Složka `dist/` obsahuje vše potřebné — `index.html`, JS, CSS a statické assety (loga, diagramy).

6. **Nastavte server** tak, aby všechny požadavky směřovaly na `index.html` (SPA fallback).

### Příkazy

| Příkaz                 | Popis                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run build-schema` | Zkompiluje YAML soubory do JSON (spouštějte po každé změně YAML) |
| `npm run dev`          | Spustí vývojový server                                           |
| `npm run build`        | Sestavení pro produkci                                           |
| `npm run preview`      | Náhled produkčního sestavení                                     |

## Dokumentace

Podrobný popis struktury YAML souborů, typů kroků a návod pro přidávání nových systémů najdete v souboru [DOCUMENTATION.md](DOCUMENTATION.md).
