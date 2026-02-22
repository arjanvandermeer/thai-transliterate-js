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
Thai Text → [Word Segmenter] → [Syllable Parser] → [Romanizer] → [Variant Generator] → Results
```

1. **Word segmentation** — `Intl.Segmenter('th')` splits multi-word text (zero dependencies)
2. **Syllable parsing** — State machine breaks Thai words into structured syllables
3. **Romanization** — Per-syllable lookup in weighted consonant/vowel tables (RTGS + informal variants)
4. **Variant generation** — Cartesian product with weight-based pruning and deduplication

See [doc/DETAILS.md](doc/DETAILS.md) for the full technical deep-dive.

## Project Structure

```
src/
  index.js              # Public API: transliterate(), matchThai(), levenshtein()
  classifier.js         # Thai character classification by Unicode range
  syllable-parser.js    # State machine: Thai text → syllable objects
  romanizer.js          # Syllable → weighted variant arrays
  variant-generator.js  # Cartesian product + pruning + dedup
  levenshtein.js        # Levenshtein edit distance
  matcher.js            # bestMatch() scoring function
  tables/
    consonants.js       # 44-consonant mapping (initial + final, multi-system)
    vowels.js           # 35 vowel patterns with weighted variants
    clusters.js         # Valid consonant clusters + ทร→"s" special case
    special-rules.js    # Ho-nam, o-nam detection

tests/
  classifier.test.js    # Character classification tests
  levenshtein.test.js   # Edit distance tests
  integration.test.js   # End-to-end transliteration + matching tests
```

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner (`node --test`).

## License

MIT
