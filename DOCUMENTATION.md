# Dokumentace — struktura YAML souborů

## Obsah

1. [Struktura složky `questions/`](#struktura-složky-questions)
2. [Jak systém funguje — od YAML k aplikaci](#jak-systém-funguje--od-yaml-k-aplikaci)
3. [Typy YAML souborů](#typy-yaml-souborů)
4. [Typy kroků (step types)](#typy-kroků-step-types)
5. [Referenční příklady syntaxe](#referenční-příklady-syntaxe)
6. [Přidání nového systému — postup](#přidání-nového-systému--postup)

---

## Struktura složky `questions/`

```
questions/
├── main.yaml                              # Vstupní bod — definice systémů a napojení větví
├── warehouses.yaml                        # Lokality a sklady
└── systems/
    ├── itls/                              # Příklad kompletního systému
    │   ├── itls.yaml                      # Hlavní soubor — otázky a napojení diagnostik
    │   ├── itls_hdt_diagnostic.yaml       # Diagnostika pro příznak "Nefunkční HDT"
    │   ├── itls_monitor_diagnostic.yaml   # Diagnostika pro příznak "Nefunkční výstupy monitoru"
    │   └── itls_nestandardni_diagnostic.yaml
    ├── lkw_control/
    │   ├── lkw_control.yaml
    │   ├── lkw_control_telematics_outage.yaml
    │   └── ...
    ├── hod/
    │   └── hod.yaml
    ├── andon/                             # ŠABLONA — k vyplnění
    │   ├── andon.yaml
    │   └── andon_diagnostic_template.yaml
    ├── logis/                             # ŠABLONA — k vyplnění
    │   ├── logis.yaml
    │   └── logis_diagnostic_template.yaml
    └── ineas_ma/                          # ŠABLONA — k vyplnění
        ├── ineas_ma.yaml
        └── ineas_ma_diagnostic_template.yaml
```

---

## Jak aplikace funguje

### Sestavení (build)

1. Soubory YAML se zkompilují příkazem `npm run build-schema` do souboru `src/assets/compiled-schema.json`
2. Direktiva `$include` v YAML souborech se rekurzivně nahradí obsahem odkazovaného souboru
3. Výsledkem je jeden plochý seznam kroků (`steps`), který aplikace načte za běhu

### Průchod uživatele aplikací

Každý YAML soubor definuje jednu fázi uživatelského průchodu:

| Soubor                                          | Co definuje                                         | Kdy se uživateli zobrazí                                                |
| ----------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `main.yaml`                                     | Výběr systému                                       | Po výběru lokality a skladu — zobrazí se mřížka systémů                 |
| `systems/SYSTÉM/SYSTÉM.yaml`                    | Otázky "K čemu?", "Jaké zařízení?", "Co nefunguje?" | Po kliknutí na systém — zobrazí se jako horizontální drill-down sloupce |
| `systems/SYSTÉM/SYSTÉM_PŘÍZNAK_diagnostic.yaml` | Diagnostické scénáře (záložky s kontrolními kroky)  | Po výběru příznaku — zobrazí se panel s číslovanými záložkami           |

### Vizuální mapování na UI

**Hlavní soubor systému** (`itls.yaml`, `andon.yaml`, ...) definuje tři `select` otázky, které se v aplikaci zobrazují jako **horizontální drill-down sloupce** (zleva doprava).

**Diagnostický soubor** (`itls_hdt_diagnostic.yaml`, ...) definuje **záložky s diagnostickými scénáři**. Každá záložka zobrazuje popis situace, doporučenou akci a údaje pro eskalaci (resolver skupina, impact, záložní strategie).

---

## Typy YAML souborů

### 1. Hlavní soubor systému (`SYSTÉM.yaml`)

Definuje **otázky pro zúžení problému** — typicky tři otázky typu `select`:

- K čemu se systém používá? (účel)
- Jaké zařízení se používá?
- Co přesně nefunguje? (příznak)

Na konci obsahuje direktivy `$include` pro napojení diagnostických souborů.

### 2. Diagnostický soubor (`SYSTÉM_PŘÍZNAK_diagnostic.yaml`)

Definuje **diagnostické scénáře** pro konkrétní příznak. Každý scénář popisuje jednu situaci a obsahuje doporučenou akci a eskalační údaje. Scénáře se zobrazují jako **číslované záložky** v doporučeném pořadí.

### 3. Soubor skladů (`warehouses.yaml`)

Definuje lokality a jejich sklady. Upravuje se pouze při změně fyzických lokací.

### 4. Vstupní bod (`main.yaml`)

Definuje seznam systémů a napojení větví. Upravuje se při přidání nového systému.

---

## Typy kroků (step types)

### `select` — Výběr z možností

Uživatel vybere jednu možnost, aplikace automaticky přejde na další krok.

```yaml
- id: nazev_otazky
  type: select
  question: "Text otázky?"
  options:
    - "Možnost A"
    - "Možnost B"
    - "Možnost C"
  render_if: "system == 'NAZEV_SYSTEMU'"
```

#### Select se skupinami (group)

Možnosti lze seskupit pod společný nadpis:

```yaml
- id: nazev_otazky
  type: select
  question: "Co přesně nefunguje?"
  options:
    - "Nefunkční HDT"
    - "Nefunkční tisk"
    - group: "Nefunkční iTLS"
      options:
        - "Nemožnost přihlášení"
        - "Výpadek systému"
        - "Chyba v rozhraní"
  render_if: "system == 'iTLS'"
```

### `diagnostic` — Diagnostický panel se scénáři

Zobrazí panel s číslovanými záložkami. Každá záložka popisuje jednu situaci s doporučenou akcí a eskalačními údaji.

```yaml
- id: nazev_diagnostic
  type: diagnostic
  question: "Diagnostika: Název příznaku"
  render_if: "system == 'SYSTÉM' && systém_symptom == 'Příznak'"
  scenarios:
    - title: "Název situace"
      description: "Popis situace (zobrazí se jako hlavní text v záložce)."
      action: "Doporučená akce / workaround."
      resolutions:
        - actual_defect: "Zjištěná závada"
          resolver_group: "Resolver skupina"
          impact: 3
          backup_strategy: "Záložní strategie"
```

#### Pole `resolutions`

- Obsahuje **právě jednu** eskalaci (jeden incident na záložku)
- Pokud scénář nevyžaduje eskalaci (uživatel si problém vyřeší sám), použijte prázdné pole: `resolutions: []`

#### Pole scénáře

| Pole          | Povinné | Popis                                             |
| ------------- | ------- | ------------------------------------------------- |
| `title`       | Ano     | Krátký název záložky                              |
| `description` | Ano     | Popis situace — hlavní text v horní části záložky |
| `action`      | Ne      | Doporučená akce / workaround                      |
| `resolutions` | Ano     | Pole s eskalačními daty (viz tabulka níže)        |

#### Pole resolution

| Pole              | Povinné | Popis                                            |
| ----------------- | ------- | ------------------------------------------------ |
| `actual_defect`   | Ano     | Zjištěná závada — popis problému pro ITSM ticket |
| `resolver_group`  | Ano     | Resolver skupina, která má incident řešit        |
| `impact`          | Ano     | Impact (1 = nejvyšší, 4 = nejnižší)              |
| `backup_strategy` | Ne      | Záložní strategie / workaround do vyřešení       |

### `hidden` — Automatické přiřazení hodnoty

Nastaví hodnotu bez zobrazení uživateli. Používá se pro mapování (např. účel → aplikace).

```yaml
- id: nazev_promenne
  type: hidden
  value: "HODNOTA"
  render_if: "system == 'iTLS' && itls_purpose == 'Ekonory (VZV) - SLS'"
```

**Poznámka:** Můžete mít více `hidden` kroků se stejným `id` ale různými podmínkami — uloží se pouze ta, jejíž podmínka platí.

### `info` — Informační zpráva

Zobrazí text s tlačítkem "Pokračovat". Pokud má `action: stop`, ukončí proces (slepá ulička).

```yaml
- id: nazev_info
  type: info
  question: "Nadpis zprávy"
  description: "Podrobný text zprávy."
  render_if: "podmínka"
  action: stop # volitelné — ukončí proces
```

---

## Referenční příklady syntaxe

### Podmínka `render_if`

Každý krok má pole `render_if`, které určuje, za jakých podmínek se krok zobrazí. Podmínka je JavaScript výraz vyhodnocený proti dosud sebraným odpovědím.

```yaml
# Jednoduchá podmínka — zobrazí se jen pro systém ANDON
render_if: "system == 'ANDON'"

# Kombinovaná podmínka — systém A konkrétní příznak
render_if: "system == 'iTLS' && itls_symptom == 'Nefunkční HDT'"

# Negace — zobrazí se pro všechny účely kromě "Něco jiného"
render_if: "system == 'HOD' && hod_purpose != 'Něco jiného'"
```

**Důležité:** Hodnoty v podmínkách musí přesně odpovídat textům v `options` (včetně velkých/malých písmen, diakritiky a mezer).

### Úniková možnost

Pokud uživatel vybere možnost, pro kterou neexistuje řešení:

```yaml
# V hlavním souboru systému — přidejte možnost
- id: andon_purpose
  type: select
  question: "K čemu se systém používá?"
  options:
    - "Účel 1"
    - "Účel 2"
    - "Něco jiného"
  render_if: "system == 'ANDON'"

# Pod tím je úniková možnost
- id: andon_purpose_dead_end
  type: info
  question: "Mimo standardní proces"
  description: "Kontaktujte svého nadřízeného nebo Leitstanda."
  render_if: "system == 'ANDON' && andon_purpose == 'Něco jiného'"
  action: stop
```

### Scénář bez eskalace (uživatel si pomůže sám)

Pokud kontrolní krok nevyžaduje vytvoření incidentu:

```yaml
scenarios:
  - title: "Kontrola baterie"
    description: "Na displeji nesvítí ikona stavu baterie."
    action: "Vyměňte baterii nebo nabijte zařízení."
    resolutions: [] # prázdné = žádná eskalace
```

### Napojení diagnostiky přes `$include`

V hlavním souboru systému se diagnostické soubory připojí direktivou `$include`:

```yaml
# Na konci hlavního souboru systému (např. andon.yaml)
# Diagnostické větve
- $include: "andon_vypadek_diagnostic.yaml"
- $include: "andon_chyba_diagnostic.yaml"
```

**Poznámka:** Cesta je relativní k aktuálnímu souboru. Pokud je diagnostický soubor ve stejné složce, stačí název souboru.

### Kompletní příklad malého systému

```yaml
# systems/priklad/priklad.yaml
steps:
  - id: priklad_purpose
    type: select
    question: "K čemu se systém používá?"
    options:
      - "Sledování výroby"
      - "Evidence materiálu"
    render_if: "system == 'PŘÍKLAD'"

  - id: priklad_device
    type: select
    question: "Jaké zařízení používáte?"
    options:
      - "Tablet"
      - "PC"
    render_if: "system == 'PŘÍKLAD'"

  - id: priklad_symptom
    type: select
    question: "Co přesně nefunguje?"
    options:
      - "Výpadek aplikace"
      - "Chyba při zadávání"
    render_if: "system == 'PŘÍKLAD'"

  # Diagnostika
  - $include: "priklad_vypadek_diagnostic.yaml"
```

```yaml
# systems/priklad/priklad_vypadek_diagnostic.yaml
steps:
  - id: priklad_vypadek_diag
    type: diagnostic
    question: "Diagnostika: Výpadek aplikace"
    render_if: "system == 'PŘÍKLAD' && priklad_symptom == 'Výpadek aplikace'"
    scenarios:
      - title: "Globální výpadek"
        description: "Aplikace nefunguje na žádném zařízení."
        action: "Informujte uživatele o globálním výpadku."
        resolutions:
          - actual_defect: "Globální výpadek systému"
            resolver_group: "LOGISTICKE SYSTEMY Support SKODA"
            impact: 1
            backup_strategy: "Manuální evidence na papír"

      - title: "Restart zařízení"
        description: "Restart zařízení nepomohl."
        action: "Zařízení vyžaduje servis."
        resolutions:
          - actual_defect: "Chyba zařízení"
            resolver_group: "AMS NTT Data Service Desk"
            impact: 3
            backup_strategy: "Použít náhradní zařízení"
```

---

## Přidání nového systému — postup

1. **Vytvořte složku** `questions/systems/<nazev_systemu>/`
2. **Vytvořte hlavní soubor** `<nazev_systemu>.yaml` se třemi `select` otázkami (účel, zařízení, příznak)
3. **Pro každý příznak** vytvořte diagnostický soubor `<nazev_systemu>_<příznak>_diagnostic.yaml`
4. **V hlavním souboru** přidejte `$include` direktivy pro každý diagnostický soubor
5. **V `main.yaml`** přidejte řádek `- $include: "./systems/<nazev_systemu>/<nazev_systemu>.yaml"` do sekce SYSTEM INCLUDES
6. **Ověřte**, že název systému v `render_if` odpovídá přesně názvu v `main.yaml` → `options`
7. **Zkompilujte** příkazem `npm run build-schema`
8. **Ověřte** aplikaci příkazem `npm run dev`
