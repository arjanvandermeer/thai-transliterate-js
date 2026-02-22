# Technical Details

Deep-dive into how `thai-transliterate` works.

## Table of Contents

- [Architecture](#architecture)
- [Thai Script Primer](#thai-script-primer)
- [Character Classifier](#character-classifier)
- [Consonant Table](#consonant-table)
- [Vowel Table](#vowel-table)
- [Special Rules](#special-rules)
- [Syllable Parser](#syllable-parser)
- [Romanizer](#romanizer)
- [Variant Generator](#variant-generator)
- [Dictionary Lookup](#dictionary-lookup)
- [Variant Discovery](#variant-discovery)
- [Matcher](#matcher)
- [Known Limitations](#known-limitations)

---

## Architecture

```
Thai Text
    │
    ▼
┌──────────────────┐
│  Word Segmenter  │  Intl.Segmenter('th', { granularity: 'word' })
└────────┬─────────┘
         │
    ▼ (per word)
┌──────────────────┐
│  Syllable Parser │  State machine, maximal onset principle
│  (syllable-      │  Handles: clusters, ho-nam, silent marks, รร, ฤ
│   parser.js)     │
└────────┬─────────┘
         │
    ▼ Array<ThaiSyllable>
┌──────────────────┐
│    Romanizer     │  Per-syllable lookup in consonant/vowel tables
│  (romanizer.js)  │  Returns WeightedVariant[][] (per-position)
└────────┬─────────┘
         │
    ▼ Array<WeightedVariant[][]>
┌──────────────────┐
│ Variant Generator│  Cartesian product + pruning + dedup + sorting
│ (variant-        │
│  generator.js)   │
└────────┬─────────┘
         │
    ▼ Array<{ text, weight }>
┌──────────────────┐
│ Dictionary Merge │  Known spellings from GeoNames/OSM + manual overrides
│ (dictionary.js)  │  Merge by text, higher weight wins
└────────┬─────────┘
         │
    ▼ TransliterationResult[]
```

### Key Design Decision: Branching at Romanizer Level

Ambiguity is handled in the **romanizer**, not the parser. The parser produces one canonical parse per syllable. Then the romanizer generates multiple weighted alternatives at each position (initial consonant, cluster, vowel, final consonant).

For example, the consonant ท has these initial variants:
- `{ text: 'th', weight: 1.0 }` — RTGS standard
- `{ text: 't', weight: 0.5 }` — informal (drops aspiration marker)

The weight of a full-word variant is the **product** of all its component weights, which naturally ranks RTGS-standard outputs highest while allowing informal alternatives.

---

## Thai Script Primer

Thai uses 44 consonants, 15+ vowel symbols (that can appear before, after, above, or below consonants), 4 tone marks, and several special markers. There are no spaces between words.

### Character Positions

```
Leading vowel  →  เ ก า  ←  Following vowel
                    ิ      ←  Above vowel
                    ุ      ←  Below vowel
                    ่      ←  Tone mark
```

A syllable like เกิ่น is: leading เ + consonant ก + above ิ + tone ่ + final น.

### Consonant Classes

Every consonant belongs to one of three classes (mid/high/low) which affect tone rules:

| Class | Consonants |
|-------|-----------|
| **Mid** | ก จ ฎ ฏ ด ต บ ป อ |
| **High** | ข ฃ ฉ ฐ ถ ผ ฝ ศ ษ ส ห |
| **Low** | ค ฅ ฆ ง ช ซ ฌ ญ ฑ ฒ ณ ท ธ น พ ฟ ภ ม ย ร ล ว ฬ ฮ |

### Why Multiple Romanizations Exist

1. **Many-to-one consonant mapping**: ข, ค, ฅ, ฆ all → "kh" initially
2. **Aspirated/unaspirated confusion**: Thai ป is unaspirated [p], which English speakers hear as "b"
3. **Competing systems**: RTGS (official), Paiboon (textbooks), ISO 11940 (academic), informal (street signs)
4. **Final consonant collapse**: All 44 consonants reduce to just 6 final sounds: -k, -ng, -t, -n, -p, -m

---

## Character Classifier

`src/classifier.js` — Pure function mapping Unicode code points to classes.

| Class | Characters | Unicode Range |
|-------|-----------|---------------|
| `SPECIAL` | ฤ ฦ | U+0E24, U+0E26 |
| `CONS` | ก-ฮ | U+0E01-U+0E2E (minus ฤ,ฦ) |
| `V_LEAD` | เ แ โ ไ ใ | U+0E40-U+0E44 |
| `V_ABOVE` | ั ิ ี ึ ื | U+0E31, U+0E34-U+0E37 |
| `V_BELOW` | ุ ู | U+0E38-U+0E39 |
| `V_FOLLOW` | ะ า ำ | U+0E30, U+0E32, U+0E33 |
| `TONE` | ่ ้ ๊ ๋ | U+0E48-U+0E4B |
| `SILENT` | ์ | U+0E4C |
| `SHORTENER` | ็ | U+0E47 |
| `NIKHA` | ํ | U+0E4D |
| `DIGIT` | ๐-๙ | U+0E50-U+0E59 |

---

## Consonant Table

`src/tables/consonants.js` — All 44 Thai consonants with weighted romanization variants for both initial and final positions.

### Key Ambiguity Points

| Thai | RTGS (initial) | Informal variants | RTGS (final) |
|------|---------------|-------------------|--------------|
| ก | k (1.0) | g (0.6) | -k |
| จ | ch (1.0) | j (0.7) | -t |
| ด | d (1.0) | dt (0.3) | -t, -d (0.4) |
| ต | t (1.0) | dt (0.3) | -t |
| บ | b (1.0) | — | -p, -b (0.4) |
| ป | p (1.0) | — | -p |
| ข/ค | kh (1.0) | k (0.5) | -k |
| ท/ธ | th (1.0) | t (0.5) | -t |
| พ/ภ | ph (1.0) | p (0.5) | -p |
| ร | r (1.0) | l (0.3) | -n (1.0), -r (0.4), silent (0.2) |
| ว | w (1.0) | v (0.3) | -w, -o (0.3) |
| ย | y (1.0) | — | -i (1.0), -y (0.7) |

### Cluster Consonants

Valid initial consonant clusters (consonant + ร/ล/ว):

```
กร กล กว  ขร ขล ขว  คร คล คว  ตร  ปร ปล
ผล  พร พล  ฝร  ฟร  สร สล สว  ทร  บร บล  ดร
```

**Special case:** ทร can be pronounced as "s" (e.g., ทราย = "sai") or "thr" depending on the word. Both variants are generated.

---

## Vowel Table

`src/tables/vowels.js` — 35 vowel patterns, each with weighted romanization variants.

### Compound Vowels (diphthongs)

| Pattern | Thai Form | RTGS | Variants |
|---------|-----------|------|----------|
| sara_ia | เ-ีย | ia | iya (0.4), ea (0.3) |
| sara_uea | เ-ือ | uea | ua (0.6), uer (0.3), eua (0.3) |
| sara_ua | -ัว | ua | uar (0.3) |
| sara_ao | เ-า | ao | ow (0.4), aw (0.3) |
| sara_oe | เ-อ | oe | er (0.6), ur (0.4), or (0.3) |

### Simple Vowels

| Pattern | Thai | RTGS | Variants |
|---------|------|------|----------|
| sara_a | -า | a | aa (0.3), ar (0.2) |
| sara_i | -ี | i | ee (0.4) |
| sara_u | -ู | u | oo (0.5) |
| sara_e | เ- | e | ay (0.3), ei (0.2) |
| sara_ae | แ- | ae | a (0.5), e (0.4) |
| sara_o | โ- | o | oh (0.3) |
| sara_ai | ไ-/ใ- | ai | i (0.4), ay (0.3) |
| sara_am | -ำ | am | um (0.4) |

### Implied Vowels

When no explicit vowel marker is written between two consonants in a closed syllable, the vowel is implied:
- `implied_o`: o (0.8), a (0.5) — used in closed syllables (CVC)
- `implied_a`: a (0.8), o (0.4) — used in open syllables

### Special Vowel Patterns

| Pattern | Thai | Sound | Variants |
|---------|------|-------|----------|
| ro_han | รร | "an" | an (1.0), un (0.3) |
| ro_han_open | รร + C | short "a" | a (1.0) |
| rue | ฤ | "ri" | ri (1.0), rue (0.6), reu (0.4) |

---

## Special Rules

### Ho-nam (หนำ)

When ห precedes a low-class consonant (ง, ญ, น, ม, ย, ร, ล, ว), the ห is **silent** — it only changes the tone class. The following consonant is the true initial.

Example: หมา → "ma" (not "hma"). The ห is consumed and suppressed.

Detected by `isHoNam(leader, follower)` in `special-rules.js`.

### O-nam

Similar pattern: อ before ย modifies tone. อย → initial is ย.

### Thanthakhat (์)

The ์ mark silences the preceding consonant. When the parser encounters ์, it marks the preceding consonant as silent and excludes it from romanization.

### ทร Cluster Variants

The cluster ทร has six romanization variants, discovered through analysis of 233K real-world place names:

| Variant | Weight | Usage | Example |
|---------|--------|-------|---------|
| thr | 0.7 | RTGS standard | อินทรา → inthra |
| dr | 0.5 | Sanskrit/Pali etymological (723 obs) | อินทรา → indra |
| tr | 0.5 | Common informal | อินทรา → intra |
| s | 0.4 | Colloquial pronunciation | ทราย → sai |
| th | 0.3 | ร-silent variant (5 obs) | ไทรงาม → thirngam |
| sr | 0.1 | Rare | ทราบ → srap |

Data-driven calibration overrides set s weight to 1.0 at runtime.

---

## Syllable Parser

`src/syllable-parser.js` — The most complex module. A state machine that scans Thai characters left-to-right and groups them into structured syllable objects.

### State Machine Flow

```
START
  ├─ V_LEAD? → record leading vowel → EXPECT_INITIAL
  ├─ CONS? → set as initial → AFTER_INITIAL
  └─ SPECIAL (ฤ/ฦ)? → emit standalone syllable → START

AFTER_INITIAL
  ├─ CONS + ho-nam? → swap initial, flag hoNam → AFTER_INITIAL
  ├─ CONS + valid cluster? → set cluster → AFTER_CLUSTER
  └─ fall through to RESOLVE_VOWEL

RESOLVE_VOWEL
  ├─ Leading vowel? → resolve compound (เ-ีย, เ-ือ, เ-อ, เ-า, etc.)
  ├─ V_ABOVE? → resolve (ั→ua/mai_han_akat, ิ, ี, ึ, ื)
  ├─ V_BELOW? → resolve (ุ, ู)
  ├─ V_FOLLOW? → resolve (ะ, า, ำ)
  ├─ ร+ร? → ro_han pattern
  └─ none → implied vowel

AFTER_VOWEL
  ├─ TONE? → record → RESOLVE_FINAL
  └─ fall through to RESOLVE_FINAL

RESOLVE_FINAL (critical decision point)
  ├─ CONS + ์ → consonant is silent, skip
  ├─ CONS + V_LEAD → consonant IS final (leading vowel starts next syllable)
  ├─ CONS + V_ABOVE/V_BELOW → consonant is NEXT initial (vowel attaches to it)
  ├─ CONS + V_FOLLOW → consonant is NEXT initial
  ├─ CONS + ร+ร → consonant is NEXT initial (with รร vowel)
  ├─ CONS + CONS (cluster) → both are NEXT syllable
  ├─ CONS + CONS + vowel → first is final, second is next initial
  ├─ CONS at end → consonant is final
  └─ no CONS → open syllable (no final)
```

### Output: Syllable Object

```js
{
  raw: 'เชียง',           // Original Thai characters
  leadingVowel: 'เ',      // Leading vowel (เ, แ, โ, ไ, ใ)
  initialConsonant: 'ช',   // Initial consonant
  clusterConsonant: null,  // Second consonant in cluster (ร, ล, ว)
  vowelPattern: 'sara_ia', // Vowel pattern ID (maps to vowel table)
  isImpliedVowel: false,   // True if no explicit vowel marker
  finalConsonant: 'ง',     // Final consonant
  toneMark: null,          // Tone mark character
  silentChars: [],         // Characters marked silent by ์
  flags: {
    hoNam: false,          // ห-นำ pattern detected
    oNam: false,           // อ-นำ pattern detected
    roHan: false,          // รร pattern detected
    thorSo: false,         // ทร → "s" candidate
  }
}
```

### Safety: Infinite Loop Prevention

The main parsing loop guarantees forward progress:
- Bare vowel/tone/silent markers without a consonant are skipped (advance by 1)
- `parseSingleSyllable` result always advances at least 1 position via `Math.max(nextIndex, i + 1)`

---

## Weight Override System

`src/tables/load-weights.js` + `src/tables/weight-overrides.json`

The romanizer uses weights from base tables (`consonants.js`, `vowels.js`, `clusters.js`) merged with data-derived overrides. This two-layer system separates manually-tuned defaults from empirical adjustments.

### How It Works

1. `load-weights.js` imports base weights from the hand-tuned table files
2. If `weight-overrides.json` exists, it replaces matching variant weights
3. The merged result is exported for use by the romanizer

### Override File Format

```json
{
  "_meta": { "description": "Data-derived weight overrides. Regenerate with: npm run calibrate" },
  "consonants": { "ก": { "initial": { "k": 1.0, "g": 0.01 } } },
  "vowels": { "implied_o": { "o": 1 } },
  "clusters": { "ทร": { "s": 1 } }
}
```

### Calibration Pipeline

Running `npm run calibrate` downloads GeoNames (265K Thai place names) and OpenStreetMap (47M entities) data, runs the transliterator against all entries, decomposes exact matches to determine which variant was chosen at each position, and normalizes the observed frequencies into weight overrides. Only overrides with ≥10 observations and >0.1 delta from base weights are included. A floor of 0.01 ensures no variant is fully eliminated.

---

## Romanizer

`src/romanizer.js` — Converts a parsed syllable into an array of positional variant arrays.

For a syllable like เชียง (chiang):
1. **Initial ช**: `[{ text: 'ch', weight: 1.0 }, { text: 'sh', weight: 0.15 }]`
2. **Vowel sara_ia**: `[{ text: 'ia', weight: 1.0 }, { text: 'iya', weight: 0.4 }, { text: 'ea', weight: 0.3 }, { text: 'ie', weight: 0.2 }]`
3. **Final ง**: `[{ text: 'ng', weight: 1.0 }, { text: 'n', weight: 0.15 }]`

These three arrays are the input to the variant generator's cartesian product.

Special cases:
- **Ho-nam syllables**: The ห is suppressed (not romanized)
- **ทร cluster**: The initial + cluster are replaced by `THOR_SO_VARIANTS` (6 variants: thr, dr, tr, s, th, sr)
- **ำ (sara am)**: Vowel includes the final -m, so no separate final consonant
- **รร (ro han)**: Vowel includes the final -n

---

## Variant Generator

`src/variant-generator.js` — Cartesian product with aggressive pruning.

### Two-Level Product

1. **Intra-syllable**: Combine initial × cluster × vowel × final for one syllable
2. **Inter-syllable**: Combine all syllable-level variants across the word

### Pruning Strategy (prevents combinatorial explosion)

| Strategy | Value | Purpose |
|----------|-------|---------|
| Weight threshold | 0.01 | Discard variants below this weight during product |
| Max per syllable | 8 | Cap intra-syllable variants after product |
| Max intermediate | 50 | Cap inter-syllable running total after each syllable |
| Max final output | 20 (configurable) | Final truncation |
| Deduplication | — | Merge identical strings, keep highest weight |

**Worst case without pruning:** A 4-syllable word with 3×3×2 positions per syllable = 18^4 = 104,976 variants. With pruning, typically 5-15 variants survive.

### Compact Variants

For multi-word output (from `Intl.Segmenter`), space-removed versions are added with a 0.9× weight multiplier. For example, "chiang mai" also generates "chiangmai" at 90% weight.

---

## Dictionary Lookup

`src/dictionary.js` — Injects known real-world spellings as additional variants.

### Two-Layer System

The dictionary uses two separate files, merged at runtime:

1. **Auto-generated** (`src/tables/dictionary.json`) — ~19K entries extracted from the GeoNames/OSM registry by `scripts/generate-dictionary.js`. Only actual transliterations are included.
2. **Manual overrides** (`src/tables/dictionary-manual.json`) — Hand-curated translations and special mappings (Bangkok, Suvarnabhumi, Thailand). NOT regenerated by calibrate.

Manual entries take precedence on collision (higher weight wins).

### Transliteration Filter

The auto-dictionary uses a Levenshtein distance filter to separate transliterations from translations. For each registry variant, the generator:

1. Runs the pure algorithmic pipeline (`parseSyllables → romanizeSyllable → generateVariants`) on the Thai text
2. Computes the minimum Levenshtein distance between the registry variant and all algorithmic outputs
3. If `minDistance / variantLength > 0.4`, the variant is a translation (not a transliteration) and is filtered out

Examples:
- "Bangkok" vs algorithmic output for กรุงเทพ → ratio 0.86 → **filtered** (translation)
- "Krung Thep" vs algorithmic → ratio 0.10 → **kept** (transliteration)
- "Sukhumvit" vs algorithmic for สุขุมวิท → ratio 0.00 → **kept** (exact match)

### Integration

During transliteration, each segmented Thai word is looked up in the dictionary via `lookupWord(thai)`. If found, dictionary variants are merged with algorithmic variants in `mergeDictionaryVariants()`:

- Deduplication by lowercase text
- Higher weight wins on collision
- Result sorted by weight, truncated to `maxVariants`

Both dictionary files are lazily loaded on first use and cached. Missing files are silently ignored.

---

## Variant Discovery

`scripts/discover-variants.js` — One-time analysis script that discovered 15 missing romanization variants from the 233K-entry GeoNames/OSM registry.

### How It Works

For each registry entry with a close match (Levenshtein distance 1-5) against algorithmic output:

1. **Parse** the Thai word into syllables and positional variant arrays
2. **Walk** the registry text left-to-right, matching known variants at each position
3. **Wildcard** — when no known variant matches, look ahead for the next known anchor and extract the novel text between cursor and anchor
4. **Aggregate** observations by (posType, key, text) and filter to ≥5 observations

### Results

From 199K close matches, 1,891 were successfully decomposed, yielding 113 unique discoveries. After manual curation (rejecting brand names like Caltex/Susco and decomposition artifacts), 15 were added to base tables. Key findings:

- ทร→"dr" (723 obs) — second most common variant, discovered from อินทรา→indra
- ช final→"ch" (54 obs) — ราชบุรี→rachburi
- จ→"c" (55 obs) — ISO/Pali romanization (กาญจนบุรี→Kancanaburi)
- sara_ao→"o" (20 obs) — เกาะ→Ko

---

## Matcher

`src/matcher.js` — Finds the best variant for an English target string.

### Scoring Formula

```
similarity = 1 - (levenshtein_distance / max_length)
score = similarity × 0.7 + weight × 0.3
```

The score combines:
- **String similarity** (70%): How close the variant text is to the target (Levenshtein-based)
- **Variant weight** (30%): How "standard" the romanization is (RTGS gets higher weight)

This means that even if a non-standard variant is slightly closer in edit distance, a standard variant that's nearly as close will still rank higher.

---

## Known Limitations

### Syllable Boundary Ambiguity

Without a dictionary, the parser uses heuristics (maximal onset principle + lookahead) to decide syllable boundaries. This works well for most words but can misparse some:

- **อ as vowel carrier**: In words like ขอน (khon), the อ functions as part of the vowel structure, but the parser treats it as a consonant. This produces "khon" via the implied vowel, but with อ as a spurious final.

- **Sanskrit/Pali loanwords**: Words like สุวรรณภูมิ (Suvarnabhumi) have etymological spellings that differ from pronunciation-based romanization. The parser produces "suwanphumi" (phonetic) rather than "suvarnabhumi" (etymological).

### No Space Insertion

Multi-syllable single-word outputs are concatenated without spaces. "เชียงใหม่" → "chiangmai" (distance 1 from "chiang mai"). The compact variant system handles the reverse (removing spaces) but not insertion.

### Missing Patterns

- ํ (nikhahit) + consonant = ำ decomposed form — not yet handled
- Some rare vowel combinations in Pali/Sanskrit loanwords
- Consonant clusters beyond the standard set (rare in modern Thai)

### Future Improvements

- **ML reranking**: Use a trained model to rerank variants by likelihood
- **Phoneme-based matching**: Weight substitution costs in Levenshtein (e.g., ph↔p costs less than ph↔z)
- **Space-aware variant generation**: Generate both spaced and unspaced versions for multi-syllable words
