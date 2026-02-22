# Sources: Thai Transliteration

A comprehensive survey of Thai romanization standards, academic sources, and how
this codebase implements transliteration.

---

## Table of Contents

- [Terminology](#terminology)
- [Romanization Systems](#romanization-systems)
  - [RTGS — Royal Thai General System of Transcription](#1-rtgs--royal-thai-general-system-of-transcription)
  - [ISO 11940 — Strict Transliteration](#2-iso-11940--strict-transliteration)
  - [ISO 11940-2 — Simplified Transcription](#3-iso-11940-2--simplified-transcription)
  - [BGN/PCGN](#4-bgnpcgn)
  - [ALA-LC — Library of Congress](#5-ala-lc--library-of-congress)
  - [Haas System](#6-haas-system)
  - [AUA System](#7-aua-system)
  - [Paiboon / Paiboon+](#8-paiboon--paiboon)
  - [UTTS — Universal Thai Transcription System](#9-utts--universal-thai-transcription-system)
  - [Other Systems](#10-other-systems)
- [System Comparison](#system-comparison)
- [Key Challenges in Thai Romanization](#key-challenges-in-thai-romanization)
- [What Thai Street Signs Actually Use](#what-thai-street-signs-actually-use)
- [Recommendations: What to Support Next](#recommendations-what-to-support-next)
- [How This Codebase Implements Transliteration](#how-this-codebase-implements-transliteration)
  - [Architecture Overview](#architecture-overview)
  - [Step 1: Word Segmentation](#step-1-word-segmentation)
  - [Step 2: Character Classification](#step-2-character-classification)
  - [Step 3: Syllable Parsing](#step-3-syllable-parsing)
  - [Step 4: Romanization](#step-4-romanization)
  - [Step 5: Variant Generation](#step-5-variant-generation)
  - [Step 6: Matching](#step-6-matching)
  - [Special Rules Implemented](#special-rules-implemented)
  - [Mapping Tables](#mapping-tables)
- [Academic References](#academic-references)
- [Web References](#web-references)

---

## Terminology

Two terms are commonly conflated but mean different things:

- **Transliteration**: Character-by-character mapping from Thai script to Latin
  script that preserves the original spelling. Reversible — you can reconstruct
  the Thai from the output. Tells you nothing about pronunciation.
- **Transcription**: Mapping based on pronunciation. Generally not reversible
  because many Thai characters share the same sound. Tells you how to say the
  word but not how to spell it.

Most systems called "romanization" are actually **transcription** systems. Only
ISO 11940 (Part 1) and ALA-LC are true transliteration systems.

This codebase is a **transcription** system — it produces pronunciation-based
output, not reversible letter-by-letter mappings. Its primary reference is RTGS
(weight 1.0) with lower-weighted alternatives from Paiboon, informal/phonetic
usage, and common street-sign conventions.

---

## Romanization Systems

### 1. RTGS — Royal Thai General System of Transcription

> **Support status: IMPLEMENTED** — Primary system. All weight-1.0 mappings in
> `src/tables/consonants.js` and `src/tables/vowels.js` are RTGS.

**Developer**: Royal Institute of Thailand (now Royal Society of Thailand)
**Type**: Transcription (pronunciation-based, non-reversible)
**Versions**: 1932, 1939, 1968, **1999** (current)

The de facto standard for Thai romanization. Used on road signs, government
publications, and most official contexts. The 1999 revision restored the
distinction between /ue/ (อึ/อื) and /u/ (อุ/อู), and simplified final ว
(always transcribed as "o").

Key characteristics:
- Uses only **unmodified Latin letters** — no diacritics
- **Does not record tones** or vowel length (short vs. long)
- Uses digraphs with `h` for aspiration: `ph`, `th`, `kh`, `ch`
  (these are NOT like English "ph" in "phone" — they are aspirated stops)
- **Non-reversible**: Many Thai characters map to the same Latin output
- Final consonants collapse to six sounds: -k, -ng, -t, -n, -p, -m

**This is the primary standard used in this codebase** (weight 1.0 in all
mapping tables).

**Specification**:
- Royal Institute of Thailand (1999). *Principles of Romanization for Thai
  Script by Transcription Method*.
  [PDF](https://www.arts.chula.ac.th/~ling/tts/principles_eng.pdf)

---

### 2. ISO 11940 — Strict Transliteration

> **Support status: NOT IMPLEMENTED** — Would require a completely different
> output mode with extensive diacritics and one-to-one character mapping.

**Developer**: International Organization for Standardization (ISO)
**Type**: True transliteration (character-by-character, fully reversible)
**Published**: 1998, updated 2003, confirmed 2008

The only international standard that preserves **all** aspects of Thai
orthography. Result bears no resemblance to pronunciation for non-specialists.

Key characteristics:
- One-to-one correspondence between Thai characters and Latin forms
- Uses **extensive diacritics** (macrons, dot below, circumflex, horn, underline)
  to distinguish the many Thai characters that share the same sound
- Records tone marks, vowel length, and all orthographic detail
- Can reconstruct original Thai script from the transliteration

Example: ภาษาไทย → `p̣has̛̄aịthy` (compare RTGS: `phasa thai`)

**Not used in this codebase** — too academic and non-pronunciation-based.

**Specification**: [ISO 11940:1998](https://www.iso.org/standard/20574.html)

---

### 3. ISO 11940-2 — Simplified Transcription

> **Support status: NOT IMPLEMENTED** — Very close to RTGS. Would only need
> `c` instead of `ch` for จ and glottal stop `'` for อ. Low effort to add.

**Developer**: ISO
**Type**: Transcription (pronunciation-based, non-reversible)
**Published**: 2007

A follow-up to ISO 11940 that defines rules to transform the strict
transliteration into a broad transcription. Nearly identical to RTGS, with
minor differences:
- Uses `c` for the affricate /tɕ/ (RTGS uses `ch`)
- Uses apostrophe `'` for glottal stops before syllable-initial vowels
- Most notable user: **Google Translate**

**Specification**: [ISO 11940-2:2007](https://www.iso.org/standard/29544.html)

---

### 4. BGN/PCGN

> **Support status: NOT IMPLEMENTED** — Based on RTGS with minor vowel
> differences. Low incremental effort once RTGS is solid.

**Developer**: US Board on Geographic Names / UK Permanent Committee on
Geographical Names
**Type**: Transcription
**Published**: 2002

Based on the Royal Institute system, officially endorsed by the Thai government
in 2000 and approved by the United Nations in 2002. Used primarily for
geographic names in maps and gazetteers.

Highly non-reversible — the Roman letter "t" alone represents **nineteen
different Thai characters** in final position.

**Specification**:
[BGN/PCGN 2002 Agreement](https://assets.publishing.service.gov.uk/media/5ab4e60aed915d78b9a459f5/ROMANIZATION_OF_THAI.pdf)

---

### 5. ALA-LC — Library of Congress

> **Support status: NOT IMPLEMENTED** — Would need macrons for long vowels
> and spiritus asper for อ. Medium effort.

**Developer**: American Library Association / Library of Congress
**Type**: Transliteration (script-based, aims for reversibility)
**Published**: 1997 (revised 2011)

Based on the 1939 RTGS version with enhancements:
- Adds **macron** for long vowels
- Uses spiritus asper to transliterate อ as a consonant
- Designed for library cataloging in English-speaking countries

More reversible than RTGS but less so than ISO 11940.

**Specification**:
[ALA-LC Thai Romanization Table (2011)](https://www.loc.gov/catdir/cpso/romanization/thai.pdf)

---

### 6. Haas System

> **Support status: NOT IMPLEMENTED** — Would need tone diacritics, `j` for
> /j/, stress marks, and vowel length doubling. High effort.

**Developer**: Mary R. Haas, American linguist
**Type**: Phonemic transcription
**Published**: 1940s, codified in *Thai-English Student's Dictionary* (1964)

The **first systematic transcription system** for Thai. IPA-influenced.

Key characteristics:
- Records **all five tones** using diacritics
- Records **vowel length** (doubled vowels: `aa`, `ii`, `uu`)
- Records glottal stops
- Uses `j` for /j/ (IPA convention, not English "y")
- Unique: records **stress** (no other system does this)

The `dt` and `bp` informal variants in this codebase's consonant table
(`src/tables/consonants.js`) reflect conventions that trace back through the
Haas → AUA → Paiboon lineage.

**Reference**: Haas, M.R. (1964). *Thai-English Student's Dictionary*. Stanford
University Press.

---

### 7. AUA System

> **Support status: NOT IMPLEMENTED** — Would need tone diacritics and vowel
> length doubling. Similar effort to Haas.

**Developer**: J. Marvin Brown, for the AUA Language Center, Bangkok
**Type**: Phonemic transcription
**Published**: 1960s

Based on the Haas system, adapted for English-speaking learners:
- Uses `y` for /j/ (more English-friendly than Haas's `j`)
- Records tones and vowel length
- Widely used in Thai language instruction for foreigners
- Adopted by the Peace Corps

**Reference**: Brown, J.M. *AUA Language Center Thai Course*.

---

### 8. Paiboon / Paiboon+

> **Support status: PARTIAL** — Some Paiboon-style consonants exist as
> low-weight informal variants (`g` 0.6, `dt` 0.3). Full Paiboon+ mode
> (swapped consonant convention, tones, hyphens) is not implemented.

**Developer**: Paiboon Publishing
**Type**: Phonemic transcription (learner-oriented)
**Published**: 1995 (Paiboon+: all recent editions)

**Critically different consonant choices** from RTGS:
- Unaspirated stops: `g` (not k), `dt` (not t), `bp` (not p)
- Aspirated stops: `k` (not kh), `t` (not th), `p` (not ph)

This reflects the perception that Thai ก sounds more like English "g" than "k"
to English speakers. The `g` (weight 0.6) and `dt` (weight 0.3) informal
variants in `src/tables/consonants.js` are directly influenced by Paiboon.

Paiboon+ adds tone marks, vowel length notation, and syllable-boundary hyphens.

**Reference**: Paiboon Publishing, *Three-Way Thai-English, English-Thai
Compact Dictionary* (2009).

---

### 9. UTTS — Universal Thai Transcription System

> **Support status: NOT IMPLEMENTED** — Newer system, would need tone and
> vowel length notation. Medium effort.

**Developer**: Thai Language Academy
**Type**: Phonemic transcription
**Published**: 2024

A newer system that builds on RTGS and ISO 11940-2, filling gaps for learners
who need tone and vowel length information without learning Thai script. Uses
standard Latin letters available on any keyboard with punctuation marks for
enhanced readability.

**Reference**:
[UTTS — Thai Language Academy](https://thailanguage.academy/universal-thai-transcription-system-utts/)

---

### 10. Other Systems

> **Support status: NOT IMPLEMENTED**

**thai-language.com (TLC)**: Uses superscripted capital letters for tone
notation. Supports multiple output systems.
[Reference](http://www.thai-language.com/ref/phonemic-transcription)

**IPA**: The most precise system. Used in academic linguistics. Available
through PyThaiNLP's transliterate module.

**PyThaiNLP**: Open-source Python library supporting multiple romanization
engines (RTGS, thai2rom deep learning, ICU, IPA).
[GitHub](https://github.com/PyThaiNLP/pythainlp)

---

## System Comparison

| Feature | RTGS | ISO 11940 | ISO 11940-2 | BGN/PCGN | ALA-LC | Haas | AUA | Paiboon+ | **This codebase** |
|---------|------|-----------|-------------|----------|--------|------|-----|----------|-------------------|
| Type | Transcription | Transliteration | Transcription | Transcription | Transliteration | Transcription | Transcription | Transcription | **Transcription** |
| Reversible | No | Yes | No | No | Mostly | No | No | No | **No** |
| Tones | No | Yes | No | No | No | Yes | Yes | Yes | **No** (parsed, not output) |
| Vowel length | No | Yes | No | No | Yes | Yes | Yes | Yes | **No** (parsed, not output) |
| Diacritics | None | Extensive | None | None | Some | Some | Some | Some | **None** |
| Primary use | Government | Scholarly | Digital | Geographic | Library | Academic | Instruction | Learning | **Matching** |
| **Support** | **Full** | **No** | **No** | **No** | **No** | **No** | **No** | **Partial** | — |

---

## Key Challenges in Thai Romanization

These challenges directly influence the design decisions in this codebase.

### 1. Tone Representation
Thai has **5 tones** (mid, low, falling, high, rising) determined by the
interaction of consonant class, tone mark, syllable type, and vowel length.
Most romanization systems omit tones entirely. **This codebase omits tones** —
tone marks are parsed but not reflected in the romanization output.

### 2. Vowel Length
Thai distinguishes short and long vowels phonemically. RTGS does not encode
this distinction. **This codebase** handles both short and long vowel patterns
(e.g., `sara_i_short` vs `sara_i`, `sara_u_short` vs `sara_u`) but the RTGS
romanization output is the same for both.

### 3. Many-to-One Consonant Mappings
44 Thai consonant symbols produce only 21 initial sounds and 6 final sounds.
Multiple characters map to the same output: ข, ค, ฅ, ฆ all become "kh". This
makes all transcription systems non-reversible.

### 4. Non-Linear Vowel Placement
Thai vowels can appear **before, after, above, below, or surrounding** the
consonant. The character classifier in `src/classifier.js` categorizes vowels
into five positional classes (`V_LEAD`, `V_ABOVE`, `V_BELOW`, `V_FOLLOW`,
`SPECIAL`) to handle this.

### 5. Word Segmentation
Thai is written **without spaces** between words. This codebase uses
`Intl.Segmenter('th', { granularity: 'word' })` for segmentation, falling back
to whitespace splitting when unavailable.

### 6. Silent Consonants
Many words (especially Sanskrit/Pali loanwords) contain silent consonants
marked by thanthakhat (์). The syllable parser detects these and excludes them
from romanization.

### 7. Consonant Clusters
Only specific combinations can form true clusters. The codebase defines 16
valid clusters in `src/tables/clusters.js`. The special case of ทร (which can
be "s" or "thr") gets dedicated handling.

### 8. Syllable Boundary Ambiguity
Without a dictionary, the parser uses the **maximal onset principle** (prefer
assigning consonants to the onset of the next syllable) with lookahead
heuristics. This works well for most words but can misparse some.

### 9. Informal Spelling Variation
In practice, Thai romanization is wildly inconsistent. The same name can be
spelled many ways on street signs, business cards, and government documents.
This codebase addresses this by generating **multiple weighted variants** per
input, covering both standard (RTGS) and common informal spellings.

---

## What Thai Street Signs Actually Use

Thai street sign romanization is, in practice, **chaos**. Understanding this
is essential context for why this codebase generates multiple weighted variants
rather than a single "correct" output.

### The Official Mandate

RTGS is the official standard mandated by the Royal Institute of Thailand since
1932 (current version: 1999). The United Nations endorsed it in 2002 for
geographic names. The Department of Highways uses it for new signage.

### The Reality

There is **no effective enforcement**. The same street can have different
spellings on signs within meters of each other. Different government agencies
produce different romanizations for the same places.

**BTS vs MRT** — Bangkok's two rail systems, both ostensibly following RTGS:

| Thai | BTS spelling | MRT spelling |
|------|-------------|-------------|
| สีลม | Silom | Si Lom |
| ชิดลม | Chit Lom | — |

Interchange stations sometimes have entirely different names: Asok (BTS) /
Sukhumvit (MRT), Sala Daeng (BTS) / Silom (MRT).

**Sanskrit/Pali Etymological Spellings** — King Vajiravudh (Rama VI) decreed in
1913 that Sanskrit/Pali-origin words should use etymological transliteration.
This coexists with RTGS, creating a dual system that persists today:

| Thai | RTGS (phonetic) | Etymological (actual signage) |
|------|----------------|------------------------------|
| สุวรรณภูมิ | Suwannaphum | **Suvarnabhumi** (airport) |
| สุขุมวิท | Sukhumwit | **Sukhumvit** (road signs) |
| ศรีราชา | Si Racha | **Sri Racha** (mixed!) |

**Documented Real-World Inconsistencies**:

| Thai | Variant 1 | Variant 2 | Variant 3+ | Issue |
|------|-----------|-----------|-----------|-------|
| ชิดลม | Chit Lom (BTS) | Chidlom (Central mall) | Chitlom | Final consonant + spacing |
| พหลโยธิน | Phahon Yothin | Phahonyothin | Phaholyothin | Word spacing + consonant |
| รัชดาภิเษก | Ratchadaphisek | Ratchadapisek | Ratchada | Cluster + informal shortening |
| ศรีราชา | Sri Racha | Si Racha | Sriracha | Sanskrit vs RTGS + spacing |
| สวัสดี | Sawatdi (RTGS) | Sawasdee | Sawatdee | Multiple conventions |

### What Google Maps Uses

Google Maps does **not** follow a single system. It uses whichever romanization
is most widely recognized: "Sukhumvit" (not RTGS), "Suvarnabhumi" (not RTGS),
but "Phahon Yothin" (RTGS-style). Google Translate reportedly uses ISO 11940-2.

### Implications for This Codebase

The weighted variant system is well-suited to this reality. Rather than picking
one "correct" romanization, the codebase generates candidates covering RTGS,
common informal, and aspiration-dropped variants. The matcher can then find the
closest match regardless of which convention a user's input follows.

The main gap: **Sanskrit/Pali etymological spellings** (Suvarnabhumi,
Sukhumvit) cannot be generated algorithmically from Thai script alone — they
require a dictionary lookup layer.

---

## Recommendations: What to Support Next

Ordered by practical impact relative to implementation effort.

### Priority 1: Data-Driven Weight Calibration ✅ IMPLEMENTED

**Status**: Complete. A calibration pipeline processes GeoNames (265K entries)
and OpenStreetMap (47M entities) to empirically derive weight adjustments.

**How it works**: `npm run calibrate` downloads fresh data, extracts Thai↔Latin
pairs, runs the transliterator against the corpus, decomposes exact matches to
determine which variant was chosen at each position, and normalizes observed
frequencies into weight overrides.

**Results**:
- 233K unique Thai names, 349K pairs
- 6.7% exact, 30.7% close (≤2 edit distance), 38.5% partial
- 70% population-weighted match rate
- Override file: `src/tables/weight-overrides.json` (checked into git)
- Key finding: ทร→"s" dominates at 85.7% vs 14.3% "thr" (base had these inverted)

**Architecture**: Override system in `src/tables/load-weights.js` merges base
weights with data-derived adjustments. Deleting `weight-overrides.json` reverts
to pure hand-tuned weights. See [DETAILS.md](DETAILS.md#weight-override-system)
for technical details.

**Still TODO**:
- Word spacing variants ("Silom" vs "Si Lom") not yet generated
- Google Places API as supplemental data source

### Priority 2: ISO 11940-2 Output Mode

**Effort**: Low-Medium | **Impact**: Medium (Google Translate compatibility)

ISO 11940-2 is nearly identical to RTGS with two differences:
1. จ → `c` (not `ch`)
2. Glottal stop before syllable-initial vowels → `'`

**Implementation**: Add an `options.system = 'iso11940-2'` flag to
`transliterate()`. In the romanizer, check the flag and swap the จ mapping.
Add glottal stop insertion logic for อ-initial syllables. ~50 lines of code.

### Priority 3: Paiboon+ Full Mode

**Effort**: Medium | **Impact**: High for language learners

Full Paiboon+ would swap the primary consonant convention:
- ก → `g` (not k), ค → `k` (not kh)
- ด → `dt` (not d), ต → `dt` (not t)
- บ → `bp` (not b), ป → `bp` (not p)

And add:
- **Tone marks** on vowels — requires implementing tone calculation from
  consonant class + tone mark + syllable type + vowel length (the parser
  already captures all inputs, but the tone algorithm is not yet implemented)
- **Vowel length** — doubled vowels for long: `aa`, `ii`, `uu` (the parser
  already distinguishes short vs long patterns)
- **Syllable-boundary hyphens**

**Implementation**: New mapping tables for Paiboon consonants. Tone calculation
function (new module, ~100 lines). Option flag `options.system = 'paiboon'`.
The parser and variant generator need no changes.

### Priority 4: Dictionary Lookup / Enrichment Layer ✅ IMPLEMENTED

**Status**: Complete. A two-layer dictionary system injects known real-world
spellings as additional transliteration variants.

**How it works**:
1. **Auto-generated dictionary** (`src/tables/dictionary.json`): ~19K entries
   extracted from the GeoNames/OSM registry. A Levenshtein distance filter
   ensures only actual transliterations are included (ratio ≤ 0.4), not
   translations like "Bangkok".
2. **Manual dictionary** (`src/tables/dictionary-manual.json`): Hand-curated
   translations and special mappings (Bangkok, Suvarnabhumi, Thailand). NOT
   regenerated by calibrate — edit by hand.
3. During transliteration, each segmented Thai word is looked up. Dictionary
   variants are merged with algorithmic variants (higher weight wins on collision).
4. Partial matches work via `Intl.Segmenter` word segmentation — compound names
   like "ถนนสุขุมวิท" are split into words, and "สุขุมวิท" matches the dictionary.

**Results**:
- 18,911 auto-generated entries, 37,529 transliteration variants
- 20,862 translation variants filtered out (Bangkok, Thailand, etc.)
- Manual dictionary seeded with 4 entries (expandable)

**Still TODO**:
- Expand manual dictionary with more well-known translations
- Google Places API as supplemental data source

### Priority 5: Variant Discovery ✅ IMPLEMENTED

**Status**: Complete. A wildcard-aware decomposition script analyzed close matches
in the registry to discover 15 romanization variants missing from base tables.

**Script**: `scripts/discover-variants.js` — one-time analysis, results baked
into `consonants.js`, `vowels.js`, `clusters.js`.

**Key discoveries**: ทร→"dr" (723 obs), ช final→"ch" (54 obs), จ→"c" (55 obs),
sara_ao→"o" (เกาะ→Ko), sara_ua→"aw" (หัวหิน→hawhin).

---

## How This Codebase Implements Transliteration

### Architecture Overview

```
Thai Text Input
    |
    v
[1. Word Segmenter]      Intl.Segmenter('th')          src/index.js
    |
    v  (per word)
[2. Char Classifier]      Unicode codepoint -> class     src/classifier.js
    |
    v
[3. Syllable Parser]      State machine, lookahead       src/syllable-parser.js
    |
    v  Array<Syllable>
[4. Romanizer]            Table lookup -> variants        src/romanizer.js
    |
    v  Array<WeightedVariant[][]>
[5. Variant Generator]    Cartesian product + pruning     src/variant-generator.js
    |
    v  Array<{ text, weight }>
[6. Matcher] (optional)   Levenshtein scoring             src/matcher.js
    |
    v  { variant, distance, weight, score }
```

**Key design decision**: Ambiguity is handled in the **romanizer** (step 4),
not the parser (step 3). The parser produces one canonical parse per syllable.
The romanizer then generates weighted alternatives at each position. This keeps
the parser simple (no backtracking) while still capturing spelling variation.

The weight of a full-word variant is the **product** of all its component
weights, which naturally ranks RTGS-standard outputs (all 1.0) highest.

---

### Step 1: Word Segmentation

**File**: `src/index.js:64-78`

Uses `Intl.Segmenter('th', { granularity: 'word' })` to split Thai text at
word boundaries. Falls back to whitespace splitting if unavailable. Each word
is processed independently through the pipeline, then results are combined
with space separators.

---

### Step 2: Character Classification

**File**: `src/classifier.js`

Maps Unicode codepoints (U+0E01–U+0E5B) to functional classes:

| Class | Characters | Range |
|-------|-----------|-------|
| `CONS` | ก-ฮ (44 consonants) | U+0E01–U+0E2E (minus ฤ, ฦ) |
| `V_LEAD` | เ แ โ ไ ใ | U+0E40–U+0E44 |
| `V_ABOVE` | ั ิ ี ึ ื | U+0E31, U+0E34–U+0E37 |
| `V_BELOW` | ุ ู | U+0E38–U+0E39 |
| `V_FOLLOW` | ะ า ำ | U+0E30, U+0E32, U+0E33 |
| `TONE` | ่ ้ ๊ ๋ | U+0E48–U+0E4B |
| `SILENT` | ์ (thanthakhat) | U+0E4C |
| `SHORTENER` | ็ (mai taikhu) | U+0E47 |
| `NIKHA` | ํ (nikhahit) | U+0E4D |
| `SPECIAL` | ฤ ฦ | U+0E24, U+0E26 |
| `DIGIT` | ๐-๙ | U+0E50–U+0E59 |

Also provides consonant class lookup (mid/high/low) used for tone
determination.

---

### Step 3: Syllable Parsing

**File**: `src/syllable-parser.js` (559 lines — the most complex module)

A state machine that scans left-to-right and groups characters into structured
syllable objects. Each syllable captures:

```
{
  raw, leadingVowel, initialConsonant, clusterConsonant,
  vowelPattern, isImpliedVowel, finalConsonant, toneMark,
  silentChars, flags: { hoNam, oNam, roHan, thorSo }
}
```

**State machine flow**:

1. **Leading vowel** — Detect เ, แ, โ, ไ, ใ
2. **Initial consonant** — Required
3. **Ho-nam / O-nam** — If ห + low-class consonant or อ + ย, swap to real
   initial, mark leader as silent
4. **Consonant cluster** — If valid cluster (initial + ร/ล/ว) with appropriate
   lookahead
5. **Vowel resolution** — Complex branching:
   - Leading vowel compounds: เ-ีย, เ-ือ, เ-อ, เ-า, เ-ะ, แ-ะ, โ-ะ
   - Above vowels: ั (→ ัว compound), ิ, ี, ึ, ื
   - Below vowels: ุ, ู
   - Following vowels: ะ, า, ำ
   - Special: รร (ro han), ฤ/ฦ (rue)
   - Implied vowel if none found
6. **Tone mark** — Recorded but not romanized
7. **Final consonant** — Uses maximal onset principle with lookahead to decide
   if a consonant is a final or the start of the next syllable

The **final consonant resolution** (`resolveFinal`, line 422) is the most
nuanced part. It examines what follows a candidate final consonant:
- Followed by above/below vowel → consonant is next syllable's initial
- Followed by leading vowel → consonant IS our final
- Followed by ์ → consonant is silent
- Followed by another consonant → check for clusters, then apply maximal onset

---

### Step 4: Romanization

**File**: `src/romanizer.js`

Converts each parsed syllable into an array of **positional variant arrays**
for cartesian product. Each position (initial, cluster, vowel, final) gets
its own array of `{ text, weight }` alternatives.

Example for เชียง:
```
Position 1 (initial ช):  [{ text: 'ch', weight: 1.0 }]
Position 2 (sara_ia):    [{ text: 'ia', weight: 1.0 }, { text: 'iya', weight: 0.4 }, ...]
Position 3 (final ง):    [{ text: 'ng', weight: 1.0 }]
```

Special cases:
- **Ho-nam**: ห suppressed from output
- **ทร → "s"**: Initial + cluster replaced by `THOR_SO_VARIANTS`
- **ำ (sara am)**: Vowel includes final `-m` (no separate final)
- **รร (ro han)**: Vowel includes final `-n`

---

### Step 5: Variant Generation

**File**: `src/variant-generator.js`

Two-level cartesian product with aggressive pruning:

1. **Intra-syllable**: Combine initial × cluster × vowel × final for one
   syllable. Cap at **8 variants** per syllable.
2. **Inter-syllable**: Combine syllable variants across the word. Cap at
   **50 intermediate variants** after each syllable addition.

Additional steps:
- **Deduplication**: Merge identical strings (case-insensitive), keep highest
  weight
- **Compact variants**: For multi-word output, add space-removed versions at
  0.9× weight (e.g., "chiang mai" → also "chiangmai")
- **Final truncation**: Top 20 variants by weight (configurable)

Without pruning, a 4-syllable word with 3 variants per position could produce
~100,000 combinations. With pruning, typically 5–15 survive.

---

### Step 6: Matching

**Files**: `src/matcher.js`, `src/levenshtein.js`

Optional step: find the best variant matching an English target string.

**Scoring formula**:
```
similarity = 1 - (levenshtein_distance / max_length)
score = similarity × 0.7 + variant_weight × 0.3
```

The 70/30 split means RTGS-standard variants get a bonus even if a non-standard
variant is slightly closer in edit distance.

The Levenshtein implementation uses single-row DP for O(min(m,n)) space.

---

### Special Rules Implemented

| Rule | File | Description |
|------|------|-------------|
| Ho-nam (หนำ) | `src/tables/special-rules.js` | ห + {ง,ญ,น,ม,ย,ร,ล,ว} → ห is silent, following consonant is true initial |
| O-nam | `src/tables/special-rules.js` | อ + ย → อ is silent, ย is true initial |
| Thanthakhat | `src/syllable-parser.js:431` | ์ silences the preceding consonant |
| ทร → "s" | `src/tables/clusters.js:38` | ทร can be "s" (0.7), "thr" (0.5), or "sr" (0.2) |
| Final collapse | `src/tables/consonants.js` | 44 consonants → 6 final sounds (-k, -ng, -t, -n, -p, -m) |
| Implied vowels | `src/syllable-parser.js:180` | CVC → implied 'o'; CV → implied 'a' |
| รร (ro han) | `src/syllable-parser.js:224` | รร at end → "an"; รร + C → short "a" + C as final |

---

### Mapping Tables

#### Consonants (44 total)

**Source file**: `src/tables/consonants.js` (321 lines)

Each consonant has: class (mid/high/low), weighted initial variants, weighted
final variants, cluster compatibility.

**Mid class** (9): ก จ ฎ ฏ ด ต บ ป อ
**High class** (11): ข ฃ ฉ ฐ ถ ผ ฝ ศ ษ ส ห
**Low class** (24): ค ฅ ฆ ง ช ซ ฌ ญ ฑ ฒ ณ ท ธ น พ ฟ ภ ม ย ร ล ว ฬ ฮ

Selected mappings showing RTGS (weight 1.0) vs informal alternatives:

| Thai | Initial (RTGS) | Informal | Final (RTGS) | Source system |
|------|---------------|----------|-------------|---------------|
| ก | k (1.0) | g (0.6) | -k | Paiboon uses g |
| จ | ch (1.0) | j (0.7) | -t | Common informal |
| ด | d (1.0) | dt (0.3) | -t, -d (0.4) | Paiboon uses dt |
| ข/ค | kh (1.0) | k (0.5) | -k | Aspiration dropped |
| ท/ธ | th (1.0) | t (0.5) | -t | Aspiration dropped |
| พ/ภ | ph (1.0) | p (0.5) | -p | Aspiration dropped |
| ร | r (1.0) | l (0.3) | -n, -r (0.4), silent (0.2) | r/l confusion |
| ว | w (1.0) | v (0.3) | -w, -o (0.3) | English influence |

#### Vowels (35 patterns)

**Source file**: `src/tables/vowels.js` (55 lines)

Categories: compound/diphthong (6), leading (12), above/below (7), following
(3), implied (2), special (3).

Selected patterns:

| Pattern | Thai Form | RTGS | Alternatives |
|---------|-----------|------|-------------|
| sara_ia | เ-ีย | ia (1.0) | iya (0.4), ea (0.3) |
| sara_uea | เ-ือ | uea (1.0) | ua (0.6), uer (0.3), eua (0.3) |
| sara_ua | -ัว | ua (1.0) | uar (0.3) |
| sara_ao | เ-า | ao (1.0) | ow (0.4), aw (0.3) |
| sara_oe | เ-อ | oe (1.0) | er (0.6), ur (0.4), or (0.3) |
| sara_am | -ำ | am (1.0) | um (0.4) — includes final -m |
| implied_o | (CVC) | o (0.8) | a (0.5) |
| ro_han | รร | an (1.0) | un (0.3) — includes final -n |

#### Consonant Clusters (16 valid)

**Source file**: `src/tables/clusters.js` (43 lines)

```
กร กล กว   ขร ขล ขว   คร คล คว   ตร   ปร ปล
ผล   พร พล   ฝร   ฟร   สร สล สว   ทร   บร บล   ดร
```

All are initial consonant + {ร, ล, ว}.

---

## Academic References

1. **Royal Institute of Thailand** (1999). *Principles of Romanization for
   Thai Script by Transcription Method*.
   [PDF](https://www.arts.chula.ac.th/~ling/tts/principles_eng.pdf)

2. **ISO 11940:1998**. *Information and documentation — Transliteration of
   Thai*. [ISO](https://www.iso.org/standard/20574.html)

3. **ISO 11940-2:2007**. *Information and documentation — Transliteration of
   Thai characters into Latin characters — Part 2: Simplified transcription*.
   [ISO](https://www.iso.org/standard/29544.html)

4. **BGN/PCGN** (2002). *Romanization of Thai*.
   [PDF](https://assets.publishing.service.gov.uk/media/5ab4e60aed915d78b9a459f5/ROMANIZATION_OF_THAI.pdf)

5. **Library of Congress** (2011). *Thai Romanization Table*.
   [PDF](https://www.loc.gov/catdir/cpso/romanization/thai.pdf)

6. **Haas, M.R.** (1964). *Thai-English Student's Dictionary*. Stanford
   University Press.

7. **Brown, J.M.** *AUA Language Center Thai Course*. AUA Language Center,
   Bangkok.

8. **Aroonmanakun, W. & Rivepiboon, W.** (2004). "A Unified Model of Thai
   Romanization and Word Segmentation." *Proceedings of the 18th Pacific Asia
   Conference on Language, Information and Computation*. Waseda University.
   [ACL Anthology](https://aclanthology.org/Y04-1021/)

9. **AyutthayaAlpha** (2024). "AyutthayaAlpha: A Thai-Latin Script
   Transliteration Transformer." [arXiv:2412.03877](https://arxiv.org/abs/2412.03877)

10. **Paiboon Publishing** (2009). *Three-Way Thai-English, English-Thai
    Compact Dictionary*.

---

## Web References

- [Romanization of Thai — Wikipedia](https://en.wikipedia.org/wiki/Romanization_of_Thai)
- [Royal Thai General System of Transcription — Wikipedia](https://en.wikipedia.org/wiki/Royal_Thai_General_System_of_Transcription)
- [ISO 11940 — Wikipedia](https://en.wikipedia.org/wiki/ISO_11940)
- [ISO 11940-2 — Wikipedia](https://en.wikipedia.org/wiki/ISO_11940-2)
- [BGN/PCGN romanization — Wikipedia](https://en.wikipedia.org/wiki/BGN/PCGN_romanization)
- [ALA-LC Romanization Tables — Library of Congress](https://www.loc.gov/catdir/cpso/roman.html)
- [Pronunciation Guide Systems — Slice of Thai](https://slice-of-thai.com/pronunciation-guides/)
- [Comparison of Three Transcription Schemes — Thai Notes](https://thai-notes.com/notes/comparisonofthreetranscriptionschemes.html)
- [Phonemic Transcription — thai-language.com](http://www.thai-language.com/ref/phonemic-transcription)
- [Thai Consonants — thai-language.com](http://www.thai-language.com/ref/consonants)
- [UTTS — Thai Language Academy](https://thailanguage.academy/universal-thai-transcription-system-utts/)
- [Remembering Mary Haas's Work on Thai — SEAlang](http://sealang.net/thai/matisoff.htm)
- [Thai Script — Wikipedia](https://en.wikipedia.org/wiki/Thai_script)
- [PyThaiNLP — GitHub](https://github.com/PyThaiNLP/pythainlp)
