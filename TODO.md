# TODO

## Space-Insertion Variants

Add variants with spaces at syllable boundaries. Many real-world romanizations
split syllables (Google Maps, street signs, user input). Currently สีลม only
produces "silom" — it should also generate "si lom" as a variant.

Examples:
- สีลม → "silom" (1.0) + "si lom" (0.9)
- สุขุมวิท → "sukhumvit" (1.0) + "su khum wit" (0.9)

The inverse of this already exists (compact variants strip spaces). This would
add the spaced-out form using syllable boundary info from the parser.

## Separate Translations from Transliterations

Currently `dictionary.js` loads both `dictionary.json` (auto-generated phonetic
entries) and `dictionary-manual.json` (hand-curated), merges them, and treats
them identically. There's no way for a caller to opt out of translations like
"Bangkok" while keeping phonetic help like "sukhumvit".

### What needs to change

**1. Split `dictionary-manual.json` into two concepts:**

- **Translations** — non-phonetic English names (Bangkok, Thailand). These
  should be disableable via `{ translations: false }`.
- **Phonetic overrides** — entries that help the algorithm pick the right
  spelling (e.g. สุขุมวิท → "sukhumvit"). These stay always-on until the
  algorithm is good enough to not need them.

**2. Allow explicit weights in `dictionary-manual.json`:**

Currently `dictionary.js` forces all manual entries to `MANUAL_WEIGHT = 1.5`,
ignoring any weight in the file. Manual entries should respect the weight in
the JSON, just like `dictionary.json` does. Remove the hardcoded `MANUAL_WEIGHT`
constant and let the file control weights:

```json
{
  "entries": {
    "กรุงเทพ": [
      { "text": "bangkok", "weight": 1.5, "type": "translation" }
    ],
    "สุขุมวิท": [
      { "text": "sukhumvit", "weight": 1.2, "type": "phonetic" }
    ]
  }
}
```

**3. Add `{ translations: false }` option flag:**

Thread the option from `transliterate()` → `processWords()` → `lookupWord()`.
When `translations: false`, skip entries marked as translations but keep
phonetic entries:

```js
transliterate('กรุงเทพ')                          // → "bangkok" (default)
transliterate('กรุงเทพ', { translations: false })  // → "krung thep"
```

Use case: karaoke machines, language learning apps, phonetic guides.

## Improve Algorithm to Eliminate dictionary.json

The phonetic dictionary (`dictionary.json`, `dictionary.js`) is a crutch —
it papers over cases where the algorithm picks the wrong variant. Every
dictionary entry is a sign that the weight tables or parser are missing
something. The goal is to make the algorithm good enough that the phonetic
dictionary can be removed entirely, leaving only the small translation
dictionary above.

Current dictionary has ~19K auto-generated entries (from GeoNames/OSM) plus
~3 manual entries. Each entry that the algorithm gets wrong is a signal about
what weights or rules need improving.

### Strategy: more data, better weights

The calibration pipeline currently uses GeoNames + OpenStreetMap (~250K pairs).
Adding more sources feeds the existing frequency-based weight system — no ML
needed, just more observations:

| Source | What it gives | Est. pairs | Signal quality |
|--------|--------------|------------|----------------|
| **Wikidata** | Entity labels (Thai + English) | ~100K+ | High (curated) |
| **Wikipedia** | Thai article titles ↔ English interwiki | ~150K | High (editorial) |
| **UNGEGN/BGN/PCGN** | Government romanization standards | ~10K | Very high (authoritative) |

Wikidata + Wikipedia are the most impactful next step — structured, clean,
and cover far more than just geography (people, food, organizations, etc.).

### Measuring progress

Track how many dictionary entries are still needed after each calibration run.
When the algorithm produces the correct top-1 variant for every entry in
`dictionary.json`, the file can be deleted.

## MCP Server

Expose the transliteration library as an MCP (Model Context Protocol) server
so LLMs and AI tools can call it directly. Useful for:

- AI assistants working with Thai text
- Translation/localization pipelines
- Any MCP-compatible client (Claude, IDEs, etc.)

Tools to expose:
- `transliterate(thai)` → best romanization string
- `transliterate_variants(thai, maxVariants?)` → ranked variant list
- `match_thai(thai, target)` → best match with distance/score
- `transliterate_words(thai)` → per-word variant arrays

Lightweight implementation: stdio transport, no dependencies beyond the
core library. Could also serve as a good example/demo of the library.

## Stretch Goals

### ML Reranking Model

Once enough data is collected from the sources above, train a simple model
(logistic regression or small neural net) to rerank variants based on learned
patterns. A bigram/trigram model over variant sequences would be a good
intermediate step before going fully neural — it could capture patterns like
"ph is almost always followed by a vowel" without heavy infrastructure.

### Publish Romanization Corpus

The variant registry built during calibration (Thai name → all observed
romanizations with frequency counts) is a useful standalone dataset. Publish
it for the NLP/linguistics community as an open Thai romanization variant
dataset.
