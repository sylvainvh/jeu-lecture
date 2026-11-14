/**
 * Proposition automatique de découpage d'un mot français en syllabes écrites
 * et de lettres muettes. Ce n'est qu'une proposition : le parent la corrige
 * et la valide dans l'éditeur avant tout enregistrement.
 */

export interface Proposal {
  determiner: string;
  syllables: string[];
  silent: boolean[];
}

const DETERMINERS = new Set([
  'un', 'une', 'le', 'la', 'les', 'des', 'du', 'de', 'au', 'aux',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'ce', 'cet', 'cette', 'ces', 'notre', 'votre', 'leur', 'nos', 'vos', 'leurs',
]);

const VOWELS = 'aàâäeéèêëiîïoôöuùûüyÿœæ';
const isVowel = (c: string | undefined) => !!c && VOWELS.includes(c);
const isLetter = (c: string) => /\p{L}/u.test(c);

/** Graphies de voyelles qui ne se séparent pas. */
const VOWEL_GROUPS = ['eau', 'œu', 'oeu', 'ai', 'aî', 'ei', 'au', 'ou', 'où', 'oû', 'oi', 'oî', 'eu', 'eû'];
/** Graphies de consonnes qui ne se séparent pas. */
const CONSONANT_GROUPS = ['ch', 'ph', 'th', 'gn'];
/** Consonnes qui forment une attaque avec l ou r (bl, tr, chr…). */
const ONSET_FIRST = new Set(['b', 'c', 'd', 'f', 'g', 'k', 'p', 't', 'v', 'ch', 'ph', 'th']);

/** Mots courants dont la consonne finale se prononce. */
const FINAL_PRONOUNCED = new Set([
  'ours', 'bus', 'autobus', 'fils', 'maïs', 'sud', 'est', 'ouest', 'gaz', 'six', 'dix', 'sept', 'huit',
  'cactus', 'tennis', 'as', 'os', 'vis', 'mars', 'sens', 'stop', 'cap', 'net', 'index', 'lynx',
  'short', 'ananas', 'iris', 'virus', 'atlas', 'but', 'zut', 'scout', 'foot', 'biceps', 'coq',
]);

interface Unit {
  start: number;
  end: number;
  vowel: boolean;
  text: string;
}

function parseUnits(s: string[]): Unit[] {
  const n = s.length;
  const units: Unit[] = [];
  const at = (i: number, str: string) => s.slice(i, i + str.length).join('') === str;
  const finalMuteE = (i: number) =>
    s[i] === 'e' && (i === n - 1 || (i === n - 2 && s[n - 1] === 's'));
  // i ou y précédé de consonne + l/r : pas de semi-voyelle (cri-er, pli-er)
  const afterCluster = (i: number) =>
    i >= 2 && 'lr'.includes(s[i - 1]) && !isVowel(s[i - 2]) && ONSET_FIRST.has(s[i - 2]);
  const nucleusLength = (i: number) => {
    const g = VOWEL_GROUPS.find((g) => at(i, g));
    return g ? [...g].length : 1;
  };

  let i = 0;
  while (i < n) {
    const c = s[i];
    const prev = units[units.length - 1];
    if (!isVowel(c)) {
      let len = 1;
      if (CONSONANT_GROUPS.some((g) => at(i, g))) len = 2;
      else if (c === 'q' && s[i + 1] === 'u') len = 2;
      else if (c === 'g' && s[i + 1] === 'u' && 'eéèêiy'.includes(s[i + 2] ?? ' ')) len = 2;
      units.push({ start: i, end: i + len, vowel: false, text: s.slice(i, i + len).join('') });
      i += len;
      continue;
    }

    // « il » après une voyelle : ail, euil, ouil, œil
    if (c === 'i' && prev?.vowel && s[i + 1] === 'l') {
      prev.end = i + 1;
      i += 1;
      continue;
    }

    let len = nucleusLength(i);
    const next = s[i + len];
    if (len === 1 && (c === 'i' || c === 'y') && isVowel(next) && !finalMuteE(i + 1) && !afterCluster(i)) {
      len += nucleusLength(i + 1); // semi-voyelle : pied, lion, yeux
    } else if (len === 1 && c === 'u' && (next === 'i' || next === 'î')) {
      len += 1; // nuit, fruit
    } else if (at(i, 'ou') && s[i + 2] === 'i' && s[i + 3] !== 'l') {
      len += 1; // oui
    }
    if (finalMuteE(i + len)) len += 1; // fée, joue, oie
    units.push({ start: i, end: i + len, vowel: true, text: s.slice(i, i + len).join('') });
    i += len;
  }
  return units;
}

/** Positions de coupure (index de caractère) à l'intérieur d'une suite de lettres. */
function breaksOf(chars: string[]): number[] {
  const units = parseUnits(chars.map((c) => c.toLowerCase()));
  const nuclei = units.map((u, i) => (u.vowel ? i : -1)).filter((i) => i >= 0);
  const breaks: number[] = [];
  for (let k = 0; k + 1 < nuclei.length; k++) {
    const cons = units.slice(nuclei[k] + 1, nuclei[k + 1]);
    const m = cons.length;
    let first: Unit; // première unité de la syllabe suivante
    if (m === 0) first = units[nuclei[k + 1]];
    else if (m === 1) first = cons[0];
    else {
      const a = cons[m - 2];
      const b = cons[m - 1];
      const onset = ONSET_FIRST.has(a.text) && (b.text === 'l' || b.text === 'r');
      first = onset ? a : b;
    }
    breaks.push(first.start);
  }
  return breaks;
}

function silentOf(chars: string[]): boolean[] {
  const s = chars.map((c) => c.toLowerCase());
  const n = s.length;
  const silent = s.map(() => false);
  s.forEach((c, i) => {
    if (c === 'h' && !'cp'.includes(s[i - 1] ?? ' ')) silent[i] = true;
  });
  if (n >= 3 && 'dpstxz'.includes(s[n - 1]) && !FINAL_PRONOUNCED.has(s.join(''))) {
    silent[n - 1] = true;
    if ('st'.includes(s[n - 1]) && 'dptg'.includes(s[n - 2]) && n >= 4) silent[n - 2] = true;
  }
  return silent;
}

/** Sépare le déterminant du reste : "un squelette" → ["un", "squelette"]. */
export function splitDeterminer(text: string): [string, string] {
  const t = text.normalize('NFC').trim().replace(/\s+/g, ' ').replace(/’/g, "'");
  const elided = /^([ldLD]')(.+)$/.exec(t);
  if (elided) return [elided[1], elided[2].trim()];
  const sp = t.indexOf(' ');
  if (sp > 0 && DETERMINERS.has(t.slice(0, sp).toLowerCase())) return [t.slice(0, sp), t.slice(sp + 1)];
  return ['', t];
}

/** Découpe un mot (sans déterminant) en syllabes + lettres muettes. */
export function syllabifyWord(word: string): { syllables: string[]; silent: boolean[] } {
  const chars = [...word.normalize('NFC')];
  const cuts = new Set<number>();
  const silent = chars.map(() => false);

  let i = 0;
  while (i < chars.length) {
    if (!isLetter(chars[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < chars.length && isLetter(chars[j])) j++;
    const chunk = chars.slice(i, j);
    // un séparateur (espace, tiret…) reste collé à la syllabe qui le précède
    if (i > 0) cuts.add(i);
    breaksOf(chunk).forEach((b) => cuts.add(i + b));
    silentOf(chunk).forEach((v, k) => (silent[i + k] = v));
    i = j;
  }
  // pas de coupure avant un séparateur de tête
  const firstLetter = chars.findIndex(isLetter);
  if (firstLetter > 0) cuts.delete(firstLetter);

  return { syllables: splitAt(chars, cuts), silent };
}

export function splitAt(chars: string[], cuts: Set<number>): string[] {
  const out: string[] = [];
  let cur = '';
  chars.forEach((c, i) => {
    if (i > 0 && cuts.has(i)) {
      out.push(cur);
      cur = '';
    }
    cur += c;
  });
  if (cur) out.push(cur);
  return out;
}

export function propose(text: string): Proposal {
  const [determiner, word] = splitDeterminer(text);
  return { determiner, ...syllabifyWord(word) };
}
