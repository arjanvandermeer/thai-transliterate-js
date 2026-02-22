# TODO

---

## Per-Word Variant API

The current `transliterate()` API returns flat strings like
`"wongwaen raminsa"` (weight 0.56) — the cartesian product of all per-word
variants pre-multiplied into final results. This is lossy: the caller can't
see which word produced which romanization, and the combinatorial explosion
happens inside the library.

### Target Output Structure

```js
transliterate("วงแหวนรามอินทรา")
// returns:
[
  {
    thai: "วงแหวน",
    variants: [
      { text: "wongwaen", weight: 0.8 },
      { text: "wangwaen", weight: 0.5 },
      { text: "wongwan", weight: 0.4 },
    ]
  },
  {
    thai: "รามอินทรา",
    variants: [
      { text: "ramintra", weight: 0.7 },
      { text: "raminthra", weight: 0.5 },
      { text: "ram intra", weight: 0.4 },
    ]
  },
]
```

### Why This Is Better

- Caller sees which Thai word produced which romanization
- Mix-and-match is the consumer's decision, not baked in
- Eliminates combinatorial explosion inside the library
- Matching logic can work per-word (much cheaper)
- Enables per-word confidence scores and debugging

### Implementation

The per-word variant arrays already exist internally — `wordVariantArrays` in
`src/index.js:29-43`. Currently they get flattened by `combineWordVariants`.

- [ ] Add a new API: `transliterateWords(thai, options)` that returns the
      per-word structure above
- [ ] Keep `transliterate()` as a convenience wrapper that flattens (backward
      compatible)
- [ ] Each entry includes the original Thai word (`thai` field) from
      `Intl.Segmenter`
- [ ] Update `matchThai()` to optionally work per-word against a target
- [ ] Update `src/matcher.js` to support per-word matching (match each Thai
      word against corresponding segments of the target string)

---

## Data-Driven Variant Weight Calibration

Build a corpus of real-world Thai-to-Latin spelling variants from geographic
data sources. Use this to empirically calibrate the variant weights in
`src/tables/consonants.js` and `src/tables/vowels.js` instead of guessing.

---

## Core Idea

Thai place names appear all over OSM — not just as road/place features, but
embedded in the names of businesses, transit stations, sois, and landmarks.
The same Thai root name (e.g., รามอินทรา) shows up romanized in dozens of
different ways across these entities:

```
รามอินทรา  →  "Ram Inthra"       (road sign)
              "Ramintra"         (BTS station)
              "Ram Intra"        (Google Maps)
              "Central Ramintra" (shopping mall)
              "Soi Ramintra 34"  (soi sign)
```

Each occurrence is a data point for how that name gets romanized in practice.
By collecting **all** OSM entities, resolving which Thai root name they
reference, and extracting the Latin spelling used, we build a **frequency
distribution of romanization variants per Thai name**.

This frequency distribution is exactly what we need to calibrate our variant
weights — high-frequency spellings should get higher weights.

---

## Phase 1: OSM Harvest (Primary Source)

OSM is the richest source because every entity that references a Thai place
name is a separate romanization data point.

### 1.1 Extract All Named Entities

- [ ] Download Thailand PBF from [Geofabrik](https://download.geofabrik.de/asia/thailand.html)
- [ ] Extract all nodes/ways/relations that have BOTH a Thai name and a Latin name
- [ ] Relevant tag combinations:
  - `name:th` + `name:en` (most common)
  - `name:th` + `name` (when `name` is Latin)
  - `name:th` + `name:th-Latn` (explicit romanization)
  - `name` contains both Thai and Latin characters (e.g., "ร้านกาแฟ Coffee House")
- [ ] Capture ALL feature types — not just places and roads:
  - `place=*` (cities, towns, villages, suburbs)
  - `highway=*` (named roads, sois)
  - `railway=station` / `station=*`
  - `amenity=*` (restaurants, cafes, hospitals, schools)
  - `shop=*`, `tourism=*`, `leisure=*`
  - `building=*` with names
  - `addr:street` + `addr:street:th` pairs
- [ ] Expected yield: 500,000+ named entities in Thailand

### 1.2 Build the Reference Name Registry

Extract the "canonical" Thai place names — the roots that other entities
reference:

- [ ] All `highway=*` names → Thai road name registry
- [ ] All `place=*` names → Thai place name registry
- [ ] All `railway=station` names → Thai station name registry
- [ ] All `admin_boundary` names → Thai admin name registry
- [ ] Store as: `{ thaiName: string, type: string, osmId: string }`

### 1.3 Resolve References (the key step)

For each non-reference entity (business, soi, etc.), determine which Thai root
name it references and extract the Latin spelling used:

- [ ] **Substring matching**: Does the entity's Thai name contain a known root?
  - "เซ็นทรัลรามอินทรา" contains "รามอินทรา" → extract "Ramintra" from "Central Ramintra"
  - "ซอยรามอินทรา 34" contains "รามอินทรา" → extract "Ramintra" or "Ram Intra" from Latin name
- [ ] **Street address matching**: `addr:street:th` = "ถนนรามอินทรา", `addr:street` = "Ram Inthra Road" → pair the Thai road name with Latin road name
- [ ] **Proximity matching**: Entities near a named road/place inherit potential name references
- [ ] **Filter out translations**: "Temple of the Emerald Buddha" is a translation, not a transliteration — detect by checking whether the Latin name shares phonemic structure with the Thai

Output per Thai root name:
```json
{
  "thai": "รามอินทรา",
  "type": "road",
  "variants": {
    "ramintra": { "count": 47, "sources": ["business", "station", "road_sign"] },
    "ram inthra": { "count": 23, "sources": ["road_sign", "address"] },
    "ram intra": { "count": 12, "sources": ["business", "google"] },
    "raam inthra": { "count": 2, "sources": ["business"] }
  }
}
```

### 1.4 Overpass API for Supplemental Queries

For targeted data that the bulk extract might miss:

```overpass
// All entities whose name contains a specific Thai road name
[out:json][timeout:300];
area["ISO3166-1"="TH"]->.thailand;
(
  nwr["name"~"รามอินทรา"](area.thailand);
  nwr["name:th"~"รามอินทรา"](area.thailand);
  nwr["addr:street:th"~"รามอินทรา"](area.thailand);
);
out tags;
```

```overpass
// All entities with both Thai and Latin names in Thailand
[out:json][timeout:600];
area["ISO3166-1"="TH"]->.thailand;
(
  nwr["name:th"]["name:en"](area.thailand);
  nwr["name:th"]["name:th-Latn"](area.thailand);
);
out tags;
```

### 1.5 OSM Considerations

- OSM data is under **ODbL license** — attribution required if we publish
- Thai OSM community is active; Bangkok especially has high coverage
- Some `name:en` values are translations, not transliterations — need filtering
- Soi numbers (ซอย 34) should be stripped before comparison
- Road prefixes (ถนน = "thanon" / "road") need normalization

---

## Phase 2: GeoNames (Structured Alternate Names)

GeoNames provides curated alternate name lists per geographic entity — less
noisy than OSM, but fewer data points per name.

- [ ] Download Thailand extract from [GeoNames](http://download.geonames.org/export/dump/) (`TH.zip`)
- [ ] Download `alternateNames.zip` for the full alternate names table
- [ ] Join on `geonameid` to get: Thai name ↔ all Latin alternate names
- [ ] Filter to populated places (P), administrative (A), transport (S)
- [ ] Expected yield: ~50,000 place names with 2-5 Latin variants each

**Key advantage over OSM**: GeoNames explicitly separates alternate names per
language, making it easy to pair Thai ↔ Latin without substring matching.

---

## Phase 3: Google Places API (Common Usage Baseline)

Google's romanization is what most users actually see and search for.

- [ ] Query Thai provinces (76) and districts (~900) by Thai script
- [ ] Query major landmarks, temples, transit stations
- [ ] Extract `name`, `address_components`, `formatted_address`
- [ ] Rate limiting: budget ~2,000 queries
- [ ] Expected yield: ~2,000-5,000 names with Google's preferred romanization

**Key advantage**: Represents the single most-seen romanization per name —
useful as a "default weight = high" signal.

---

## Phase 4: Processing Pipeline

### 4.1 Merge Across Sources

- [ ] Unify into: `{ thai: string, variants: Map<string, { count, sources }> }`
- [ ] Normalize variants: lowercase, strip diacritics, collapse whitespace
- [ ] Merge counts when same variant appears in multiple sources
- [ ] Flag Google's romanization as a separate signal (not just another count)

### 4.2 Run Current Transliterator Against Corpus

- [ ] For each Thai name, run `transliterate()` with current weights
- [ ] Record: which real-world variants are in our output? Which are missed?
- [ ] Calculate **coverage**: % of real-world variants we generate
- [ ] Calculate **ranking accuracy**: does our highest-weighted variant match the most-frequent real-world variant?

### 4.3 Analyze Variant Patterns

Group missed variants by the **type of deviation** from RTGS:

- [ ] **Consonant substitution**: k↔g, ch↔j, ph↔p, th↔t, etc.
- [ ] **Aspiration dropped**: kh→k, th→t, ph→p, ch→c
- [ ] **Vowel variation**: ai↔ay↔i, oe↔er↔ur, uea↔ua, etc.
- [ ] **Word spacing**: Ramintra vs Ram Intra vs Ram Inthra
- [ ] **Final consonant voicing**: t↔d, p↔b, k↔g
- [ ] **r/l confusion**: r↔l in both initial and final position
- [ ] **Sanskrit/Pali etymological**: Suvarnabhumi, Sukhumvit (can't be algorithmic)

For each pattern, compute:
- How often it appears in the wild
- What weight we currently assign (if any)
- Recommended new weight based on frequency

### 4.4 Calibrate Weights

- [ ] Adjust weights in `src/tables/consonants.js` based on frequency data
- [ ] Adjust weights in `src/tables/vowels.js` based on frequency data
- [ ] Add any missing variant patterns discovered in the data
- [ ] Re-run 4.2 to verify improved coverage
- [ ] Ensure existing integration tests still pass

### 4.5 Add Space-Insertion Variants

Analysis will likely confirm syllable-boundary spacing is a top-3 source of
variation (Silom/Si Lom, Ramintra/Ram Intra, Phahonyothin/Phahon Yothin).

- [ ] Add logic to `src/variant-generator.js` to insert spaces at syllable
      boundaries as a low-weight variant
- [ ] Currently only compact (space-removal) variants are generated — this is
      the inverse operation

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

## Output Artifacts

- [ ] `data/registry.json` — Thai root names with all observed Latin variants and counts
- [ ] `data/analysis.json` — Pattern analysis, coverage report, weight recommendations
- [ ] Updated weight tables in `src/tables/*.js`
- [ ] New integration tests for common place names from the corpus

---

## Stretch Goals

- [ ] Build a "common names" dictionary from the corpus for the Sanskrit/Pali
      etymological mode (see `doc/SOURCES.md` Priority 4)
- [ ] Detect and flag likely translations vs transliterations automatically
- [ ] Use the corpus as training data for an ML reranking model
- [ ] Publish the corpus as a standalone Thai romanization variant dataset
- [ ] Build a web UI to browse the variant registry (Thai name → all spellings)
