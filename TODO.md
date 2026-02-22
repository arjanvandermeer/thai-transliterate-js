# TODO

---

## Per-Word Variant API ✅

Implemented. `transliterateWords(thai, options)` returns per-word variant
arrays. `transliterate()` remains as a convenience wrapper.

---

## Data-Driven Variant Weight Calibration ✅

Implemented. A full calibration pipeline processes GeoNames (265K entries) and
OpenStreetMap (47M entities) to empirically derive weight adjustments. Results
are stored in `src/tables/weight-overrides.json` (checked into git), separate
from the hand-tuned base weights.

Run `npm run calibrate` to regenerate from fresh data.

### Results (initial calibration)
- 233K unique Thai names, 349K Thai↔Latin pairs
- 6.7% exact matches, 30.7% close, 38.5% partial
- 70% population-weighted match rate
- Pipeline converged to 6 stable weight overrides

---

## Phase 1: OSM Harvest ✅

Implemented in `scripts/extract-osm.js`. Streams `data/thailand-latest.osm.pbf`
(304MB, 47M entities) via `osm-pbf-parser-node`. Extracts `name:th` + `name:en`
pairs and `addr:street:th` + `addr:street` pairs. Categorizes by OSM tags.
Output: `data/registry-osm.json` — 100K unique Thai names, 192K pairs.

---

## Phase 2: GeoNames ✅

Implemented in `scripts/extract-geonames.js`. Parses `data/TH.zip` (265K entries).
Filters junk Latin variants (ISO 11940, IATA codes, non-ASCII). Pairs Thai and
Latin names from alternate names column. Output: `data/registry-geonames.json` —
159K unique Thai names, 378K pairs.

---

## Phase 3: Google Places API

Not yet implemented. Could supplement existing data.

- [ ] Query Thai provinces (76) and districts (~900) by Thai script
- [ ] Query major landmarks, temples, transit stations
- [ ] Extract `name`, `address_components`, `formatted_address`
- [ ] Rate limiting: budget ~2,000 queries
- [ ] Expected yield: ~2,000-5,000 names with Google's preferred romanization

---

## Phase 4: Processing Pipeline ✅

Implemented across multiple scripts:

- **Merge**: `scripts/merge-registries.js` → `data/registry.json` (233K names, 349K pairs)
- **Analyze**: `scripts/analyze-registry.js` → `data/analysis.json` (match quality + weight evidence)
- **Generate**: `scripts/generate-overrides.js` → `src/tables/weight-overrides.json`
- **Runtime**: `src/tables/load-weights.js` merges base weights with overrides

### Still TODO

- [ ] Add space-insertion variants at syllable boundaries (Silom → "Si Lom")

---

## Phase 5: Word Tokenization

### Current State (tested 2026-02-22)

`Intl.Segmenter('th', { granularity: 'word' })` on Node.js works well for
compound names:

```
วงแหวนรามอินทรา     →  [วงแหวน | รามอินทรา]         ✓ correct split
ถนนสุขุมวิท          →  [ถนน | สุขุมวิท]              ✓ prefix split
สนามบินสุวรรณภูมิ     →  [สนาม | บิน | สุวรรณภูมิ]     ✓ compound split
ซอยรามอินทรา         →  [ซอย | รามอินทรา]             ✓ prefix split
กรุงเทพมหานคร        →  [กรุงเทพมหานคร]              ~ kept as one (debatable)
```

**Verdict**: Tokenization is working. The main issues are in the syllable
parser and romanizer, not the tokenizer. Issues found:

| Input | Current output | Expected | Root cause |
|-------|---------------|----------|------------|
| ถนน | "thonna" | "thanon" | Implied vowel + syllable boundary wrong |
| ซอย | "soya" | "soi" | Vowel resolution: ออย misparses |
| ศรี | "sari" | "si" / "sri" | ศร cluster not handled as special case |
| พหล | "phola" | "phahon" | Syllable boundary: หล is ho-nam |

### 5.1 Remaining Tokenization Work

- [ ] **Cross-environment testing**: Verify `Intl.Segmenter` behavior in
      browsers (Chrome, Safari, Firefox) and older Node.js versions
- [ ] **Fallback tokenizer**: For environments without `Intl.Segmenter`,
      consider [wordcut](https://github.com/veer66/wordcut) (JS,
      dictionary-based) as a fallback
- [ ] **Place name dictionary**: Use the OSM registry (Phase 1.2) as a
      supplemental dictionary — if a known place name appears as a substring,
      force a word break there

### 5.2 Syllable Parser Bug Fixes (discovered during tokenization testing)

These are parser/romanizer bugs, not tokenization issues, but they surfaced
during testing:

- [ ] ถนน → "thonna": implied vowel is wrong. ถ-น-น should parse as
      ถะ-หนน → "tha-non" (two syllables) not "thon-na"
- [ ] ซอย → "soya": should be "soi". The ออย vowel pattern needs fixing
- [ ] ศรี → "sari": ศร should be recognized as producing "s" sound (like ทร→"s")
      or ศ initial = "s" with ร as part of next syllable
- [ ] พหล in พหลโยธิน: หล is a ho-nam pattern (ห+ล), the parser should
      detect this across a syllable boundary

---

## Output Artifacts ✅

All generated:
- [x] `data/registry.json` — 233K Thai names with all observed Latin variants and counts
- [x] `data/analysis.json` — Match quality, weight evidence, top misses
- [x] `src/tables/weight-overrides.json` — Data-derived weight adjustments
- [ ] New integration tests for common place names from the corpus

---

## Next: Dictionary/Enrichment Lookup

Build a JSON-based dictionary of known Thai↔Latin translations from the
GeoNames/OSM data. When a Thai input matches (or partially matches) a
dictionary entry, add the real-world spellings as variants or boost their
scoring in the output.

- [ ] Generate dictionary from registry data (high-confidence exact matches)
- [ ] Integrate lookup into transliteration pipeline
- [ ] Handle partial matches (substrings of Thai input)

---

## Stretch Goals

- [ ] Detect and flag likely translations vs transliterations automatically
- [ ] Use the corpus as training data for an ML reranking model
- [ ] Publish the corpus as a standalone Thai romanization variant dataset
- [ ] Build a web UI to browse the variant registry (Thai name → all spellings)
