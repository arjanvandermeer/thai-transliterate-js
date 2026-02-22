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
- [x] ศรี → "sari": ✅ Fixed. ศร cluster now handled as special case → "si", "sri"
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

## Dictionary/Enrichment Lookup ✅

Implemented. A two-layer dictionary system injects known real-world spellings
as additional transliteration variants.

- [x] Generate dictionary from registry data (`scripts/generate-dictionary.js`)
- [x] Levenshtein distance filter separates transliterations from translations
- [x] Manual overrides file (`src/tables/dictionary-manual.json`) for translations
- [x] Integrate lookup into transliteration pipeline (`src/dictionary.js`)
- [x] Partial matches via `Intl.Segmenter` word segmentation

### Results
- 18,911 auto-generated entries, 37,529 transliteration variants
- 20,862 translation variants filtered out
- Manual dictionary seeded with 4 entries (Bangkok, Suvarnabhumi, Thailand)

### Still TODO
- [ ] Expand manual dictionary with more well-known translations
- [ ] Investigate dictionary variant coverage for multi-word entries

---

## Variant Discovery from Registry Data ✅

Implemented in `scripts/discover-variants.js`. A wildcard-aware decomposition
algorithm analyzes close matches (Levenshtein distance 1-5) in the 233K-entry
GeoNames/OSM registry to find romanization patterns missing from the base tables.

### Process
1. For each registry entry, generate algorithmic variants and find close matches
2. Walk the registry text left-to-right against the syllable position template
3. When no known variant matches, use anchor-based wildcard extraction
4. Aggregate observations, filter noise (brand names, decomposition artifacts)

### Results
- 199K close matches analyzed, 1,891 decompositions, 113 unique discoveries
- 16 legitimate variants curated (stored in `weight-overrides.json` `newVariants`)
- ~97 rejected as brand name noise or decomposition artifacts

### Discovered Variants (in `weight-overrides.json` newVariants section)

Base JS tables contain only RTGS/well-established variants. Data-derived
additions live in the `newVariants` section of `weight-overrides.json`:

**Consonant initials**: จ→"c" (ISO/Pali), ช→"sh" (loanword), ธ→"dh" (Pali),
ท→"d" (informal), พ→"bh" (Pali)

**Consonant finals**: ช→"ch" (54 obs, ราชบุรี→rachburi), ญ→"y" (สำราญ→saray),
ฬ→"l" (บึงกาฬ→bungkal), ง→"n" (ระนอง→ranon)

**Vowels**: sara_ao→"o" (เกาะ→Ko), sara_ua→"aw" (หัวหิน→hawhin),
sara_uea→"ue", sara_i→"y" (กระบี่→kraby), sara_ia→"ie"

**Clusters**: ทร→"th" (ร silent), ทร→"dr" (อินทรา→indra, 723 obs)

---

## Stretch Goals

- [ ] Detect and flag likely translations vs transliterations automatically
- [ ] Use the corpus as training data for an ML reranking model
- [ ] Publish the corpus as a standalone Thai romanization variant dataset
- [ ] Build a web UI to browse the variant registry (Thai name → all spellings)
