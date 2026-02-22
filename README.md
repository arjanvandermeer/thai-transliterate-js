# thai-transliterate

Multi-variant Thai-to-Roman transliteration library. Takes Thai text as input and returns **multiple weighted romanization variants**, enabling fuzzy matching against English spellings via Levenshtein distance.

## The Problem

Thai romanization is inherently ambiguous. One Thai word can have many valid English spellings because:

- 44 Thai consonants collapse to 21 initial sounds (ข/ค/ฅ/ฆ all → "kh")
- Aspirated vs unaspirated distinction doesn't map cleanly to English (ป = "p" but sounds like "b")
- 6+ romanization systems in active use (RTGS, Paiboon, ISO 11940, informal)
- Final consonants collapse (44 → 6 sounds: -k, -ng, -t, -n, -p, -m)
- Vowel length and tone information lost in most systems
- No spaces between words in Thai script

For example, รามอินทรา can be "Ramintra", "Ram Inthra", or "Ramindra".

## Installation

```bash
npm install thai-transliterate
```

Requires Node.js >= 20.0.0. Zero runtime dependencies.

## Usage

### Generate all romanization variants

```js
import { transliterate } from 'thai-transliterate';

transliterate('ภูเก็ต');
// [
//   { text: 'phuket', weight: 1.0 },
//   { text: 'phuget', weight: 0.6 },
//   { text: 'phooket', weight: 0.5 },
//   { text: 'puket', weight: 0.5 },
//   ...
// ]
```

### Match Thai against an English string

```js
import { matchThai } from 'thai-transliterate';

matchThai('ภูเก็ต', 'phuket');
// { variant: 'phuket', distance: 0, weight: 1.0, score: 1.0 }

matchThai('เชียงใหม่', 'chiang mai');
// { variant: 'chiangmai', distance: 1, weight: 1.0, score: 0.93 }
```

### Standalone Levenshtein distance

```js
import { levenshtein } from 'thai-transliterate';

levenshtein('ramintra', 'ramindra'); // 1
```

## API

### `transliterate(thai, options?)`

Transliterate Thai text to Roman/Latin characters. Returns multiple weighted variants sorted by likelihood.

**Parameters:**
- `thai` (string) — Thai text to transliterate
- `options.maxVariants` (number, default 20) — Maximum variants to return
- `options.minWeight` (number, default 0.01) — Minimum weight threshold
- `options.includeCompact` (boolean, default true) — Include space-removed variants for multi-word output

**Returns:** `Array<{ text: string, weight: number }>`

### `matchThai(thai, target, options?)`

Convenience wrapper: transliterates Thai text and finds the best Levenshtein match against an English target.

**Parameters:**
- `thai` (string) — Thai text
- `target` (string) — English string to match against
- `options.maxDistance` (number) — Maximum acceptable distance (no limit by default)
- Plus all `transliterate` options

**Returns:** `{ variant: string, distance: number, weight: number, score: number } | null`

### `levenshtein(a, b)`

Compute the Levenshtein edit distance between two strings.

**Returns:** `number`

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
  index.js              # Public API: transliterate(), matchThai(), levenshtein()
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
| 2 | `calibrate:extract-geonames` | Parse GeoNames → `data/registry-geonames.json` |
| 3 | `calibrate:extract-osm` | Parse OSM PBF → `data/registry-osm.json` |
| 4 | `calibrate:merge` | Merge registries → `data/registry.json` |
| 5 | `calibrate:analyze` | Run transliterator against corpus → `data/analysis.json` |
| 6 | `calibrate:generate` | Generate `src/tables/weight-overrides.json` |
| 7 | `calibrate:dictionary` | Generate `src/tables/dictionary.json` |

Intermediate `data/*.json` files are gitignored. Only `weight-overrides.json` and `dictionary.json` are tracked.

### How Overrides Work

The override system (`src/tables/load-weights.js`) merges base weights with data-derived adjustments at runtime:
- If `weight-overrides.json` exists, matching weights are replaced
- Base weights are always the fallback for any consonant/vowel/cluster not in overrides
- Deleting the override file reverts to pure hand-tuned weights
- The file is human-readable JSON, easy to manually inspect or edit

## Dictionary Lookup

Known real-world spellings from GeoNames/OSM data are injected as additional variants during transliteration. This two-layer dictionary system handles both transliterations and translations.

### Auto-Generated Dictionary (`dictionary.json`)

Contains ~19K entries with phonetically-verified transliterations extracted from the registry. A Levenshtein distance filter ensures only actual transliterations are included (not translations like "Bangkok" or "Thailand" — those go in the manual file).

Regenerated by `npm run calibrate:dictionary`. Tracked in git.

### Manual Dictionary (`dictionary-manual.json`)

Hand-curated translations and special mappings that are **NOT** regenerated by calibrate. Includes historical names (Bangkok), Sanskrit/Pali etymological forms (Suvarnabhumi), and other non-phonetic mappings. Edit this file directly.

### How It Works

During transliteration, each segmented Thai word is looked up in the dictionary. If found, dictionary variants are merged with algorithmic variants — higher weight wins on collision, deduplication by lowercase text. Manual entries take precedence over auto-generated ones.

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner (`node --test`).

## License

MIT
