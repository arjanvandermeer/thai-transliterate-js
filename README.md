# thai-transliterate

Multi-variant Thai-to-Roman transliteration library. Zero dependencies, Node.js >= 20.

## Getting Started

```bash
npm install thai-transliterate
```

```js
import { transliterate } from 'thai-transliterate';

transliterate('กรุงเทพ');    // 'bangkok'
transliterate('ภูเก็ต');      // 'phuket'
transliterate('เชียงใหม่');   // 'chiang mai'
transliterate('สุขุมวิท');     // 'sukhumvit'
```

That's it. `transliterate()` takes Thai text and returns the most likely romanization as a single string.

## Why This Library?

Thai romanization is inherently ambiguous — one Thai word can have many valid English spellings:

- 44 consonants collapse to 21 initial sounds (ข/ค/ฅ/ฆ all → "kh")
- Aspirated vs unaspirated doesn't map cleanly to English (ป = "p" but sounds like "b")
- 6+ romanization systems in active use (RTGS, Paiboon, ISO 11940, informal)
- No spaces between words in Thai script

For example, รามอินทรา can be "Ramintra", "Ram Inthra", or "Ramindra".

This library generates **all plausible romanization variants** with weights, calibrated against 265K GeoNames entries and 47M OpenStreetMap entities. The top variant is returned by default, but the full weighted list is available for fuzzy matching.

## API

### `transliterate(thai, options?)` → `string`

Returns the most likely romanization as a single string.

```js
transliterate('กรุงเทพ');   // 'bangkok'
transliterate('hello');      // 'hello' (non-Thai passes through)
transliterate('');           // ''
```

### `transliterateVariants(thai, options?)` → `Array<{ text, weight }>`

Returns all weighted romanization variants, sorted by weight descending.

```js
import { transliterateVariants } from 'thai-transliterate';

transliterateVariants('ภูเก็ต');
// [
//   { text: 'phuket', weight: 1.0 },
//   { text: 'phuget', weight: 0.6 },
//   { text: 'phooket', weight: 0.5 },
//   ...
// ]
```

**Options:**
- `maxVariants` (number, default 20) — Maximum variants to return
- `minWeight` (number, default 0.01) — Minimum weight threshold
- `includeCompact` (boolean, default true) — Include space-removed variants for multi-word output

### `transliterateWords(thai, options?)` → `Array<{ thai, variants }>`

Returns per-word breakdown with variants for each segmented word.

```js
import { transliterateWords } from 'thai-transliterate';

transliterateWords('ถนนสุขุมวิท');
// [
//   { thai: 'ถนน', variants: [{ text: 'thanon', weight: 1.0 }, ...] },
//   { thai: 'สุขุมวิท', variants: [{ text: 'sukhumvit', weight: 1.1 }, ...] }
// ]
```

### `matchThai(thai, target, options?)` → `{ variant, distance, weight, score } | null`

Transliterates Thai text and finds the best Levenshtein match against an English target.

```js
import { matchThai } from 'thai-transliterate';

matchThai('ภูเก็ต', 'phuket');
// { variant: 'phuket', distance: 0, weight: 1.0, score: 1.0 }

matchThai('เชียงใหม่', 'chiang mai');
// { variant: 'chiangmai', distance: 1, weight: 1.0, score: 0.93 }
```

**Options:**
- `maxDistance` (number) — Maximum acceptable distance (no limit by default)
- Plus all `transliterateVariants` options

### Thai Detection

```js
import { containsThai, isAllThai, isMostlyThai } from 'thai-transliterate';

containsThai('hello กรุงเทพ world');  // true
isAllThai('กรุงเทพ มหานคร');          // true
isMostlyThai('กรุงเทพมหานคร BKK');   // true
```

### `levenshtein(a, b)` → `number`

Levenshtein edit distance between two strings.

```js
import { levenshtein } from 'thai-transliterate';

levenshtein('ramintra', 'ramindra'); // 1
```

## Accuracy

Tested against common Thai place names:

| Thai | Expected | Best Match | Distance |
|------|----------|------------|----------|
| ภูเก็ต | phuket | phuket | 0 |
| ทราย | sai | sai | 0 |
| เชียงใหม่ | chiang mai | chiangmai | 1 |
| กรุงเทพ | krung thep | krungthep | 1 |
| หาดใหญ่ | hat yai | hatyai | 1 |
| รามอินทรา | ramintra | raminthra | 1 |
| สมุทรปราการ | samut prakan | samutraprakan | 2 |

Distance-1 results are mostly the space difference (compound words output without spaces).

## How It Works

```
Thai Text → [Word Segmenter] → [Syllable Parser] → [Romanizer] → [Variant Generator] → [Dictionary Merge] → Results
```

1. **Word segmentation** — `Intl.Segmenter('th')` splits multi-word text (zero dependencies)
2. **Syllable parsing** — State machine breaks Thai words into structured syllables
3. **Romanization** — Per-syllable lookup in weighted consonant/vowel tables (RTGS + informal variants)
4. **Variant generation** — Cartesian product with weight-based pruning and deduplication
5. **Dictionary merge** — Known spellings from GeoNames/OSM injected as additional variants

See [doc/DETAILS.md](doc/DETAILS.md) for the full technical deep-dive.

## Project Structure

```
src/
  index.js              # Public API: transliterate(), transliterateVariants(), matchThai(), etc.
  classifier.js         # Thai character classification by Unicode range
  syllable-parser.js    # State machine: Thai text → syllable objects
  romanizer.js          # Syllable → weighted variant arrays
  variant-generator.js  # Cartesian product + pruning + dedup
  dictionary.js         # Dictionary lookup for known Thai↔Latin mappings
  levenshtein.js        # Levenshtein edit distance
  matcher.js            # bestMatch() scoring function
  tables/
    consonants.js       # 44-consonant mapping (initial + final, multi-system)
    vowels.js           # 35 vowel patterns with weighted variants
    clusters.js         # Valid consonant clusters + ทร/ศร special variants
    special-rules.js    # Ho-nam, o-nam detection
    load-weights.js     # Merges base weights with data-derived overrides
    weight-overrides.json   # Data-derived weight adjustments (regeneratable)
    dictionary.json         # Auto-generated transliterations from GeoNames/OSM
    dictionary-manual.json  # Hand-curated translations/overrides (not regenerated)

scripts/
  transliterate-places.js   # CLI: transliterate Thai place names
  download-data.js          # Download GeoNames + OSM data files
  extract-geonames.js       # Parse GeoNames → registry
  extract-osm.js            # Parse OSM PBF → registry
  merge-registries.js       # Merge data source registries
  analyze-registry.js       # Run transliterator against corpus, extract evidence
  generate-overrides.js     # Generate weight-overrides.json from analysis
  generate-dictionary.js    # Generate dictionary.json from registry
  discover-variants.js      # One-time: discover missing romanization variants

data/
  thai-places.json          # ~530 Thai place names for testing (tracked)
  thai-places-output.json   # Generated transliteration output (tracked)

tests/
  classifier.test.js       # Character classification tests
  integration.test.js      # End-to-end transliteration + matching tests
  levenshtein.test.js      # Edit distance tests
  syllable-parser.test.js  # Syllable parsing tests
  romanizer.test.js        # Romanization tests
  variant-generator.test.js# Variant generation tests
  thai-places.test.js      # Place name regression tests
  load-weights.test.js     # Weight override system tests
  dictionary.test.js       # Dictionary lookup tests
```

## Data-Driven Weight Calibration

The base weights in `consonants.js` and `vowels.js` are manually tuned RTGS defaults. A calibration pipeline uses real-world GeoNames (265K entries) and OpenStreetMap (47M entities) data to derive empirical weight adjustments.

### Quick Start

```bash
npm run calibrate
```

This downloads fresh data and regenerates `src/tables/weight-overrides.json` and `src/tables/dictionary.json`. Both files are checked into git.

### Pipeline Steps

| Step | Command | Description |
|------|---------|-------------|
| 1 | `calibrate:download` | Download GeoNames TH.zip + OSM PBF |
| 2 | `calibrate:extract-geonames` | Parse GeoNames → `data/registry-geonames.json` (with feature-type multipliers) |
| 3 | `calibrate:extract-osm` | Parse OSM PBF → `data/registry-osm.json` (with category multipliers) |
| 4 | `calibrate:merge` | Merge registries → `data/registry.json` |
| 5 | `calibrate:analyze` | Run transliterator against corpus → `data/analysis.json` |
| 6 | `calibrate:discover` | Discover missing romanization variants from close matches |
| 7 | `calibrate:generate` | Generate `src/tables/weight-overrides.json` |
| 8 | `calibrate:dictionary` | Generate `src/tables/dictionary.json` |

Intermediate `data/*.json` files are gitignored. Only `weight-overrides.json` and `dictionary.json` are tracked.

### How Overrides Work

The override system (`src/tables/load-weights.js`) merges base weights with data-derived adjustments at runtime:
- **Weight adjustments**: If `weight-overrides.json` has a matching variant in `consonants`/`vowels`/`clusters`, its weight is replaced
- **New variants**: The `newVariants` section adds variants not present in base tables (e.g., ทร→"dr", จ→"c")
- Base weights are always the fallback for any consonant/vowel/cluster not in overrides
- Deleting the override file reverts to pure RTGS base weights
- The file is human-readable JSON, easy to manually inspect or edit

## Dictionary Lookup

Known real-world spellings from GeoNames/OSM data are injected as additional variants during transliteration. This two-layer dictionary system handles both transliterations and translations.

### Auto-Generated Dictionary (`dictionary.json`)

Contains ~19K entries with phonetically-verified transliterations extracted from the registry. A Levenshtein distance filter ensures only actual transliterations are included (not translations like "Bangkok" or "Thailand" — those go in the manual file).

Dictionary weights use a **three-tier priority system**:

| Priority | Weight | Source |
|----------|--------|--------|
| 1st | **1.5** (hardcoded) | Manual dictionary (`dictionary-manual.json`) |
| 2nd | **1.0–1.1** (confidence-based) | Auto dictionary with ≥5 observations |
| 3rd | **1.0** | Algorithmic RTGS |

Observation counts are **category-weighted** at extraction time — airports and train stations count 3× more than generic entries, while restaurants and shops count 0.3–0.5×. This ensures well-known place names (like สุวรรณภูมิ → "suvarnabhumi") naturally outrank phonetic variants without manual overrides.

Regenerated by `npm run calibrate:dictionary`. Tracked in git.

### Manual Dictionary (`dictionary-manual.json`)

Hand-curated translations and special mappings that are **NOT** regenerated by calibrate. Reserved for true translations where the English name has no phonetic relationship to the Thai script (e.g., กรุงเทพ → "bangkok"). All manual entries get a hardcoded weight of 1.5 (`MANUAL_WEIGHT` in `src/dictionary.js`), guaranteeing they outrank everything else.

### How It Works

During transliteration, each segmented Thai word is looked up in the dictionary. If found, dictionary variants are merged with algorithmic variants — higher weight wins on collision, deduplication by lowercase text. Manual entries always outrank auto-generated and algorithmic variants.

## Override Files Reference

All data files that modify the transliteration output at runtime, beyond the base JS tables:

| File | Purpose | Created by | Modify? |
|------|---------|-----------|---------|
| `src/tables/weight-overrides.json` | Adjusts variant weights + adds new data-derived variants | `npm run calibrate` (auto-generated) | Yes — edit JSON directly for manual tweaks, or regenerate with calibrate |
| `src/tables/dictionary.json` | ~19K known transliterations from GeoNames/OSM | `npm run calibrate:dictionary` (auto-generated) | Regenerate only — edits will be overwritten |
| `src/tables/dictionary-manual.json` | Hand-curated translations (Bangkok, Thailand) | Manual | Yes — edit directly, never overwritten by calibrate |

### Architecture: Code vs Data

The base JS tables (`consonants.js`, `vowels.js`, `clusters.js`) contain only **RTGS standard and well-established linguistic variants**. All data-derived modifications live in JSON files:

- **Weight adjustments** (e.g., ทร→"s" bumped from 0.4 to 1.0) → `weight-overrides.json` top-level sections
- **New variant additions** (e.g., ทร→"dr", จ→"c") → `weight-overrides.json` `newVariants` section
- **Known real-world spellings** (e.g., สุขุมวิท→"sukhumvit") → `dictionary.json` + `dictionary-manual.json`

This separation ensures that `consonants.js`/`vowels.js`/`clusters.js` reflect linguistic fact, while all empirical tuning is in editable JSON files.

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner (`node --test`).

## License

MIT
