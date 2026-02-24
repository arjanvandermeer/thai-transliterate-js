import { classifyChar, canBeFinal } from './classifier.js';
import { isValidCluster } from './tables/clusters.js';
import { isHoNam, isONam } from './tables/special-rules.js';
import { VOWEL_PATTERNS } from './tables/load-weights.js';

/**
 * Parse Thai text into an array of syllable objects.
 *
 * Each syllable has:
 *   raw             - original Thai characters
 *   leadingVowel    - leading vowel char if present (เ, แ, โ, ไ, ใ)
 *   initialConsonant - first consonant
 *   clusterConsonant - second consonant in cluster (ร, ล, ว)
 *   vowelPattern    - vowel pattern id (maps to vowel table)
 *   isImpliedVowel  - true if no explicit vowel marker
 *   finalConsonant  - final consonant char if present
 *   toneMark        - tone mark char if present
 *   silentChars     - characters marked silent by ์
 *   flags           - { hoNam, oNam, roHan, thorSo }
 */
export function parseSyllables(text) {
  const chars = [...text];
  const len = chars.length;
  const syllables = [];
  let i = 0;

  while (i < len) {
    const cls = classifyChar(chars[i]);

    // Skip non-Thai characters — pass through as-is
    if (cls === 'OTHER' || cls === 'DIGIT') {
      syllables.push({
        raw: chars[i],
        initialConsonant: '',
        vowelPattern: '',
        isImpliedVowel: false,
        silentChars: [],
        flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
        passthrough: true,
      });
      i++;
      continue;
    }

    // Handle ฤ/ฦ as standalone syllable
    if (cls === 'SPECIAL') {
      syllables.push({
        raw: chars[i],
        initialConsonant: '',
        vowelPattern: 'rue',
        isImpliedVowel: false,
        silentChars: [],
        flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
      });
      i++;
      continue;
    }

    // Skip bare vowel/tone/silent markers that appear without a consonant
    if (cls === 'V_ABOVE' || cls === 'V_BELOW' || cls === 'V_FOLLOW' ||
        cls === 'TONE' || cls === 'SILENT' || cls === 'SHORTENER' || cls === 'NIKHA') {
      i++;
      continue;
    }

    // Main syllable parsing
    const syl = parseSingleSyllable(chars, i, len);
    syllables.push(syl.syllable);
    // Safety: always advance at least one position to prevent infinite loops
    i = Math.max(syl.nextIndex, i + 1);
  }

  // Mark syllable position so the romanizer can apply position-aware rules
  // (e.g., ทร→"s" only in word-initial position)
  for (let s = 0; s < syllables.length; s++) {
    syllables[s].isFirstSyllable = s === 0;
  }

  return syllables;
}

function parseSingleSyllable(chars, start, len) {
  let i = start;
  let leadingVowel = null;
  let initialCons;
  let clusterCons = null;
  let vowelPattern;
  let finalCons = null;
  let toneMark = null;
  const silentChars = [];
  let hoNam = false;
  let oNam = false;
  let roHan = false;
  let thorSo = false;
  let sorRo = false;
  let isImplied = false;

  // Step 1: Check for leading vowel
  const cls0 = classifyChar(chars[i]);
  if (cls0 === 'V_LEAD') {
    leadingVowel = chars[i];
    i++;
    if (i >= len) {
      // Dangling leading vowel — emit as-is
      return result(chars, start, i, {
        leadingVowel, initialConsonant: '', vowelPattern: '', isImpliedVowel: false,
        silentChars, flags: { hoNam, oNam, roHan, thorSo, sorRo }, passthrough: true,
      });
    }
  }

  // Step 2: Initial consonant (required)
  if (i >= len || classifyChar(chars[i]) !== 'CONS') {
    // No consonant found — emit what we have as passthrough
    return result(chars, start, i, {
      leadingVowel, initialConsonant: '', vowelPattern: '', isImpliedVowel: false,
      silentChars, flags: { hoNam, oNam, roHan, thorSo, sorRo }, passthrough: true,
    });
  }
  initialCons = chars[i];
  i++;

  // Step 3: Check for ho-nam or o-nam
  if (i < len && classifyChar(chars[i]) === 'CONS') {
    if (isHoNam(initialCons, chars[i])) {
      // Suppress ho-nam if the follower consonant is immediately followed by a
      // leading vowel (เ/แ/โ/ไ/ใ). In that case the follower is more likely the
      // final of this syllable, not a ho-nam initial.
      // e.g., พหลโยธิน: ห+ล+โ → ล is final of ห's syllable, โ starts next syllable.
      const afterFollower = i + 1;
      const suppressHoNam = afterFollower < len && classifyChar(chars[afterFollower]) === 'V_LEAD';
      if (!suppressHoNam) {
        hoNam = true;
        // ห is silent, the following consonant is the true initial
        initialCons = chars[i];
        i++;
      }
    } else if (isONam(initialCons, chars[i])) {
      oNam = true;
      initialCons = chars[i];
      i++;
    }
  }

  // Step 4: Check for consonant cluster
  if (i < len && classifyChar(chars[i]) === 'CONS' && isValidCluster(initialCons, chars[i])) {
    // Look ahead: is the next char a vowel or consonant?
    const nextCls = i + 1 < len ? classifyChar(chars[i + 1]) : 'OTHER';
    const isVowelAhead = nextCls === 'V_ABOVE' || nextCls === 'V_BELOW' ||
                         nextCls === 'V_FOLLOW' || nextCls === 'TONE' ||
                         nextCls === 'SHORTENER' || nextCls === 'OTHER';
    // Accept cluster if: followed by a vowel, has a leading vowel wrapping it,
    // or at end of input
    if (isVowelAhead || leadingVowel || i + 1 >= len) {
      clusterCons = chars[i];
      if (initialCons === 'ท' && clusterCons === 'ร') {
        thorSo = true;
      }
      if (initialCons === 'ศ' && clusterCons === 'ร') {
        sorRo = true;
      }
      i++;
    }
  }

  // Step 5: Look for vowel markers (above, below, following) and special patterns
  vowelPattern = resolveVowel(chars, i, len, leadingVowel, initialCons, clusterCons);
  i = vowelPattern.nextIndex;
  const vowelId = vowelPattern.id;
  roHan = vowelPattern.roHan || false;
  // hasShortener available in vowelPattern for future tone rules

  // Step 6: Tone mark
  if (i < len && classifyChar(chars[i]) === 'TONE') {
    toneMark = chars[i];
    i++;
  }

  // Step 7: Silent mark (์) — marks the following or preceding consonant as silent
  // Actually ์ comes after the consonant it silences, so we check in final consonant logic

  // Step 8: Final consonant
  // Check if the vowel pattern already includes a final (e.g., ำ includes -m, รร includes -n)
  const vowelEntry = getVowelEntry(vowelId);
  const vowelIncludesFinal = vowelEntry && vowelEntry.includesFinal;

  if (!vowelIncludesFinal && i < len) {
    const finalResult = resolveFinal(chars, i, len);
    finalCons = finalResult.finalConsonant;
    silentChars.push(...finalResult.silentChars);
    i = finalResult.nextIndex;
  }

  // If no explicit vowel and no leading vowel, it's an implied vowel
  if (vowelId === 'none') {
    isImplied = true;
    // Implied vowel depends on whether there's a final consonant
    // With final consonant: implied short 'o' (closed syllable)
    // Without: implied short 'a' (but this is rare/ambiguous)
  }

  const actualVowelPattern = isImplied
    ? (finalCons ? 'implied_o' : 'implied_a')
    : vowelId;

  return result(chars, start, i, {
    leadingVowel,
    initialConsonant: initialCons,
    clusterConsonant: clusterCons,
    vowelPattern: actualVowelPattern,
    isImpliedVowel: isImplied,
    finalConsonant: finalCons,
    toneMark,
    silentChars,
    flags: { hoNam, oNam, roHan, thorSo, sorRo },
  });
}

/**
 * Resolve the vowel pattern starting at position i.
 * Returns { id, nextIndex, roHan, hasShortener }
 */
function resolveVowel(chars, i, len, leadingVowel, _initialCons, _clusterCons) {
  // Handle leading vowel combinations
  if (leadingVowel) {
    return resolveLeadingVowel(chars, i, len, leadingVowel);
  }

  // No leading vowel — check for above/below/following vowels
  if (i >= len) {
    return { id: 'none', nextIndex: i };
  }

  const cls = classifyChar(chars[i]);

  // Check for รร (ro han) pattern
  // Only valid if the second ร is NOT followed by a vowel marker
  // (if it is, the second ร is actually an initial of the next syllable, not part of รร)
  if (i < len && chars[i] === 'ร' && i + 1 < len && chars[i + 1] === 'ร') {
    const afterRR = i + 2;
    // Reject if the second ร is followed by a vowel (the second ร is a new syllable initial)
    const clsAfterRR = afterRR < len ? classifyChar(chars[afterRR]) : 'OTHER';
    const secondRIsInitial = clsAfterRR === 'V_ABOVE' || clsAfterRR === 'V_BELOW' ||
                             clsAfterRR === 'V_FOLLOW' || clsAfterRR === 'V_LEAD';
    if (!secondRIsInitial) {
      if (afterRR < len && clsAfterRR === 'CONS') {
        // รร + consonant = short 'a' with the consonant as final
        return { id: 'ro_han_open', nextIndex: afterRR, roHan: true };
      }
      // รร at end = "an"
      return { id: 'ro_han', nextIndex: afterRR, roHan: true };
    }
  }

  // Above vowels: ั ิ ี ึ ื
  if (cls === 'V_ABOVE') {
    return resolveAboveVowel(chars, i, len);
  }

  // Below vowels: ุ ู
  if (cls === 'V_BELOW') {
    return resolveBelowVowel(chars, i, len);
  }

  // Following vowels: ะ า ำ
  if (cls === 'V_FOLLOW') {
    return resolveFollowingVowel(chars, i);
  }

  // Shortener ็ without explicit vowel
  if (cls === 'SHORTENER') {
    return { id: 'none', nextIndex: i + 1, hasShortener: true };
  }

  // Sara aw (สระ ออ): อ functioning as vowel /ɔː/ between consonants
  // Pattern: C₁อ(C₂) — the อ IS the vowel, not a consonant
  // Triggers when อ is followed by: CONS, TONE, or end-of-word
  // Does NOT trigger when followed by: V_ABOVE, V_BELOW, V_FOLLOW, V_LEAD, SILENT
  // (those cases mean อ is the initial consonant of the next syllable)
  if (chars[i] === 'อ') {
    const afterO = i + 1;
    if (afterO >= len) {
      return { id: 'sara_aw', nextIndex: afterO };
    }
    const clsAfterO = classifyChar(chars[afterO]);
    if (clsAfterO === 'CONS' || clsAfterO === 'TONE') {
      return { id: 'sara_aw', nextIndex: afterO };
    }
  }

  // No vowel found
  return { id: 'none', nextIndex: i };
}

function resolveLeadingVowel(chars, i, len, lead) {
  // เ combinations
  if (lead === 'เ') {
    // เ-ีย (sara ia): look for ี then ย
    if (i + 1 < len && chars[i] === '\u0E35' /* ี */) {
      // Check: is this actually ี followed by ย?
      // Note: ี is above the consonant which we already consumed
      // Actually, the position i is AFTER the initial consonant(+cluster)
      // So chars[i] would be the above vowel ี
      if (classifyChar(chars[i]) === 'V_ABOVE' && chars[i] === '\u0E35') {
        if (i + 1 < len && chars[i + 1] === 'ย') {
          return { id: 'sara_ia', nextIndex: i + 2 };
        }
      }
    }

    // เ-ือ (sara uea): ื then อ
    if (i < len && chars[i] === '\u0E37' /* ื */) {
      if (i + 1 < len && chars[i + 1] === 'อ') {
        return { id: 'sara_uea', nextIndex: i + 2 };
      }
      // เ-ือะ (sara uea short): ื then อ then ะ
      // (rare, handled by checking for ะ after อ)
    }

    // เ-็ (with shortener, e.g. เ-็-): short 'e' with mai taikhu
    if (i < len && classifyChar(chars[i]) === 'SHORTENER') {
      return { id: 'sara_e_short', nextIndex: i + 1, hasShortener: true };
    }

    // เ-อ (sara oe): check if next is อ
    // Must be careful: อ could be a consonant (next syllable initial) or part of เ-อ vowel
    // Heuristic: if อ is followed by nothing, or by a consonant (not a vowel), it's เ-อ
    if (i < len && chars[i] === 'อ') {
      const afterO = i + 1;
      if (afterO >= len) {
        return { id: 'sara_oe', nextIndex: afterO };
      }
      const clsAfterO = classifyChar(chars[afterO]);
      // เ-อะ (sara oe short)
      if (chars[afterO] === '\u0E30' /* ะ */) {
        return { id: 'sara_oe_short', nextIndex: afterO + 1 };
      }
      // If followed by a consonant or end, it's sara_oe (long)
      if (clsAfterO === 'CONS' || clsAfterO === 'V_LEAD' || clsAfterO === 'OTHER' || afterO >= len) {
        return { id: 'sara_oe', nextIndex: afterO };
      }
    }

    // เ-า (sara ao): check for า
    if (i < len && chars[i] === '\u0E32' /* า */) {
      return { id: 'sara_ao', nextIndex: i + 1 };
    }

    // เ-ะ (sara e short)
    if (i < len && chars[i] === '\u0E30' /* ะ */) {
      return { id: 'sara_e_short', nextIndex: i + 1 };
    }

    // เ- (sara e long) — default for เ with no special following
    return { id: 'sara_e', nextIndex: i };
  }

  // แ combinations
  if (lead === 'แ') {
    if (i < len && chars[i] === '\u0E30' /* ะ */) {
      return { id: 'sara_ae_short', nextIndex: i + 1 };
    }
    return { id: 'sara_ae', nextIndex: i };
  }

  // โ combinations
  if (lead === 'โ') {
    if (i < len && chars[i] === '\u0E30' /* ะ */) {
      return { id: 'sara_o_short', nextIndex: i + 1 };
    }
    return { id: 'sara_o', nextIndex: i };
  }

  // ไ (sara ai mai malai)
  if (lead === 'ไ') {
    return { id: 'sara_ai_malai', nextIndex: i };
  }

  // ใ (sara ai mai muan)
  if (lead === 'ใ') {
    return { id: 'sara_ai_muan', nextIndex: i };
  }

  return { id: 'none', nextIndex: i };
}

function resolveAboveVowel(chars, i, len) {
  const ch = chars[i];

  // ั (mai han akat) — could be part of compound: ัว (sara ua) or ัวะ
  if (ch === '\u0E31' /* ั */) {
    if (i + 1 < len && chars[i + 1] === 'ว') {
      // ัว: check for ะ after
      if (i + 2 < len && chars[i + 2] === '\u0E30' /* ะ */) {
        return { id: 'sara_ua_short', nextIndex: i + 3 };
      }
      return { id: 'sara_ua', nextIndex: i + 2 };
    }
    return { id: 'mai_han_akat', nextIndex: i + 1 };
  }

  // ิ (sara i short) vs ี (sara i long)
  if (ch === '\u0E34' /* ิ */) {
    return { id: 'sara_i_short', nextIndex: i + 1 };
  }
  if (ch === '\u0E35' /* ี */) {
    return { id: 'sara_i', nextIndex: i + 1 };
  }

  // ึ (sara ue short) vs ื (sara ue long)
  if (ch === '\u0E36' /* ึ */) {
    return { id: 'sara_ue_short', nextIndex: i + 1 };
  }
  if (ch === '\u0E37' /* ื */) {
    // Check for ื + อ = เ-ือ (but that requires leading เ, handled in resolveLeadingVowel)
    // Standalone ื is sara_ue long
    return { id: 'sara_ue', nextIndex: i + 1 };
  }

  return { id: 'none', nextIndex: i };
}

function resolveBelowVowel(chars, i, _len) {
  const ch = chars[i];
  if (ch === '\u0E38' /* ุ */) {
    return { id: 'sara_u_short', nextIndex: i + 1 };
  }
  if (ch === '\u0E39' /* ู */) {
    return { id: 'sara_u', nextIndex: i + 1 };
  }
  return { id: 'none', nextIndex: i };
}

function resolveFollowingVowel(chars, i) {
  const ch = chars[i];
  if (ch === '\u0E30' /* ะ */) {
    return { id: 'sara_a_short', nextIndex: i + 1 };
  }
  if (ch === '\u0E32' /* า */) {
    return { id: 'sara_a', nextIndex: i + 1 };
  }
  if (ch === '\u0E33' /* ำ */) {
    return { id: 'sara_am', nextIndex: i + 1 };
  }
  return { id: 'none', nextIndex: i };
}

/**
 * Resolve the final consonant(s) at position i.
 * Handles silent marks (์) and consonant stacking.
 * Returns { finalConsonant, silentChars, nextIndex }
 */
function resolveFinal(chars, i, len) {
  if (i >= len || classifyChar(chars[i]) !== 'CONS') {
    return { finalConsonant: null, silentChars: [], nextIndex: i };
  }

  // Peek ahead to decide if this consonant is a final or the start of a new syllable
  const cons = chars[i];

  // If followed by ์ (silent mark), this consonant is silent, not a final
  if (i + 1 < len && classifyChar(chars[i + 1]) === 'SILENT') {
    return { finalConsonant: null, silentChars: [cons], nextIndex: i + 2 };
  }

  // If this consonant can never be a final in Thai (ห, ฉ, ผ, ฝ, ฮ, อ),
  // it must start the next syllable
  if (!canBeFinal(cons)) {
    return { finalConsonant: null, silentChars: [], nextIndex: i };
  }

  // Decision: is this consonant a final, or the initial of the next syllable?
  // Use lookahead with maximal onset principle.
  const nextIdx = i + 1;
  if (nextIdx >= len) {
    // End of input: this is a final
    return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
  }

  const nextCls = classifyChar(chars[nextIdx]);

  // If followed by an above/below vowel or shortener, this consonant
  // is the INITIAL of the next syllable — not our final
  // (these vowels attach directly to the consonant they follow)
  if (nextCls === 'V_ABOVE' || nextCls === 'V_BELOW' || nextCls === 'SHORTENER') {
    return { finalConsonant: null, silentChars: [], nextIndex: i };
  }

  // If followed by V_FOLLOW: ะ/า/ำ — this consonant starts the next syllable
  if (nextCls === 'V_FOLLOW') {
    return { finalConsonant: null, silentChars: [], nextIndex: i };
  }

  // If followed by V_LEAD (เ, แ, โ, ไ, ใ), the leading vowel belongs to the NEXT
  // consonant, so this consonant IS our final
  if (nextCls === 'V_LEAD') {
    return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
  }

  // If followed by another consonant:
  if (nextCls === 'CONS') {
    const nextCons = chars[nextIdx];

    // Special: if cons + ร + ร (รร pattern), this cons is the initial of the next
    // syllable (with รร as its vowel), NOT our final
    if (nextCons === 'ร' && nextIdx + 1 < len && chars[nextIdx + 1] === 'ร') {
      return { finalConsonant: null, silentChars: [], nextIndex: i };
    }

    // If the two consonants form a valid cluster, both belong to the next syllable
    if (isValidCluster(cons, nextCons)) {
      // Check what follows the cluster — if a vowel, it's definitely next syllable
      const afterCluster = nextIdx + 1;
      if (afterCluster < len) {
        const clsAfterCluster = classifyChar(chars[afterCluster]);
        if (clsAfterCluster === 'V_ABOVE' || clsAfterCluster === 'V_BELOW' ||
            clsAfterCluster === 'V_FOLLOW' || clsAfterCluster === 'SHORTENER') {
          // This cons + next cons = cluster for next syllable
          return { finalConsonant: null, silentChars: [], nextIndex: i };
        }
      }
      // End-of-word cluster: first consonant is final, second is silent.
      // Thai words can't end in consonant clusters.
      if (afterCluster >= len) {
        return { finalConsonant: cons, silentChars: [nextCons], nextIndex: nextIdx + 1 };
      }
    }

    // If the next consonant is followed by ์ (silent), consume both cons+์
    // and then this consonant might still be a final
    if (nextIdx + 1 < len && classifyChar(chars[nextIdx + 1]) === 'SILENT') {
      // Next consonant is silenced. This consonant is our final.
      return {
        finalConsonant: cons,
        silentChars: [nextCons],
        nextIndex: nextIdx + 2,
      };
    }

    // If cons is followed by a consonant that can be the initial of the next syllable
    // (maximal onset): check what follows the next consonant
    const afterNext = nextIdx + 1;
    if (afterNext < len) {
      const clsAfterNext = classifyChar(chars[afterNext]);

      // If next-next is a vowel or leading vowel, the next consonant starts
      // a new syllable, and this consonant is our final
      if (clsAfterNext === 'V_ABOVE' || clsAfterNext === 'V_BELOW' ||
          clsAfterNext === 'V_FOLLOW' || clsAfterNext === 'V_LEAD' ||
          clsAfterNext === 'SHORTENER') {
        return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
      }

      // If next-next is a consonant that could form a cluster with next,
      // then next+next-next are the cluster of the next syllable, and cons is our final
      if (clsAfterNext === 'CONS') {
        if (isValidCluster(nextCons, chars[afterNext])) {
          return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
        }
        // Otherwise cons is still likely our final (two consonants follow = final + next initial)
        return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
      }

      if (clsAfterNext === 'TONE') {
        return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
      }
    }

    // End-of-word: two consonants that don't form a cluster.
    // C₁ starts a new syllable with implied vowel; C₂ becomes its final.
    if (afterNext >= len && !isValidCluster(cons, nextCons)) {
      return { finalConsonant: null, silentChars: [], nextIndex: i };
    }

    // Default: this consonant is the final
    return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
  }

  // If followed by tone mark: the tone might belong to the next syllable or this one
  // Since we're looking for a final, and tone marks sit above consonants...
  // A tone mark after our candidate final usually belongs to the candidate
  // (it would be unusual to have tone on a final consonant, but it happens)
  if (nextCls === 'TONE') {
    // Check after the tone mark
    const afterTone = nextIdx + 1;
    if (afterTone >= len) {
      // Tone mark is dangling — treat consonant as final
      return { finalConsonant: cons, silentChars: [], nextIndex: afterTone };
    }
    // Tone marks typically go with the initial consonant, not the final
    // So if there's a tone mark, this consonant is probably the INITIAL of next syllable
    return { finalConsonant: null, silentChars: [], nextIndex: i };
  }

  // Default: treat as final
  return { finalConsonant: cons, silentChars: [], nextIndex: nextIdx };
}

function result(chars, start, end, syllable) {
  syllable.raw = chars.slice(start, end).join('');
  return { syllable, nextIndex: end };
}

function getVowelEntry(vowelId) {
  return VOWEL_PATTERNS[vowelId] || null;
}
