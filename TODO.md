# TODO

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

## Pure Algorithmic Mode (`{ dictionary: false }`)

Add a `dictionary` option (default: `true`) that, when set to `false`, skips all
dictionary lookup — both auto-generated (`dictionary.json`) and manual
(`dictionary-manual.json`). This gives callers access to the raw algorithmic
transliteration without any dictionary overrides or corrections.

Use cases:
- Debugging/development: see what the algorithm produces before dictionary patching
- Measuring algorithm quality: compare pure output against known-good dictionary entries
- Callers who want deterministic, rule-based output without external data dependencies

Implementation: thread `options.dictionary` through `processWords()` in `src/index.js`
and skip the `lookupWord()` call when `dictionary === false`. Works orthogonally with
the existing `{ translations: false }` option.

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
