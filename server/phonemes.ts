/**
 * Découpage de la prononciation (phonèmes API produits par le phonémiseur de Piper)
 * en syllabes, alignées sur les syllabes écrites du mot. On part de la prononciation
 * du mot entier : lire les syllabes écrites une à une donnerait des sons faux
 * (« é » lu « e accent aigu », « cham » sans voyelle nasale…).
 */

const VOWELS = new Set([...'aɑeɛioɔuyøœə']);
const GLIDES = new Set([...'jwɥ']);
const LIQUIDS = new Set([...'lʁ']);
const OBSTRUENTS = new Set([...'pbtdkɡfv']);
const NASAL = '̃';

const isVowel = (p: string) => VOWELS.has(p[0]);

/** Nettoie la sortie du phonémiseur : accents toniques retirés, signes combinants recollés. */
export function cleanPhones(raw: string[]): string[] {
  const out: string[] = [];
  for (const p of raw) {
    if (p === NASAL || p === 'ː') {
      if (out.length) out[out.length - 1] += p;
    } else if (p !== 'ˈ' && p !== 'ˌ' && /[\p{L}]/u.test(p)) out.push(p);
  }
  // « nuit », « huit » : le u devant une voyelle est une semi-voyelle
  return out.map((p, i) => (p === 'y' && out[i + 1] && isVowel(out[i + 1]) ? 'ɥ' : p));
}

/** Combien de consonnes, en fin de groupe, ouvrent la syllabe suivante (pl, tʁ, pj, tʁw…). */
function onsetLength(cons: string[]): number {
  let n = Math.min(1, cons.length);
  const at = (k: number) => cons[cons.length - k];
  if (n && GLIDES.has(at(n)) && cons.length > n) n++;
  if (n && LIQUIDS.has(at(n)) && cons.length > n && OBSTRUENTS.has(at(n + 1))) n++;
  return n;
}

export function phoneticSyllables(phones: string[]): string[][] {
  const nuclei = phones.map((p, i) => (isVowel(p) ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length <= 1) return phones.length ? [phones] : [];
  const out: string[][] = [];
  let start = 0;
  for (let k = 0; k + 1 < nuclei.length; k++) {
    const cons = phones.slice(nuclei[k] + 1, nuclei[k + 1]);
    const cut = nuclei[k + 1] - onsetLength(cons);
    out.push(phones.slice(start, cut));
    start = cut;
  }
  out.push(phones.slice(start));
  return out;
}

const WRITTEN_VOWELS = 'aàâäeéèêëiîïoôöuùûüyÿœæ';
/** Syllabe écrite dont la seule voyelle est un e final muet : « te », « gne », « bre », « que ». */
function isMuteE(written: string): boolean {
  const s = written.toLowerCase().replace(/[^\p{L}]/gu, '').replace(/([qg])u/g, '$1');
  const m = /^(.+?)e(s|nt)?$/.exec(s);
  return !!m && ![...m[1]].some((c) => WRITTEN_VOWELS.includes(c));
}

/**
 * Fait correspondre syllabes prononcées et syllabes écrites. À l'oral un e muet
 * disparaît (« é-cole ») ; comme à l'école, on le fait entendre : « é-co-le ».
 * Renvoie null si l'on n'arrive pas au même nombre de syllabes.
 */
export function alignToWritten(written: string[], phonetic: string[][]): string[][] | null {
  const out: string[][] = [];
  let pi = 0;
  for (let j = 0; j < written.length; j++) {
    const deficit = written.length - j > phonetic.length - pi;
    const prev = out[out.length - 1];
    if (deficit && prev && isMuteE(written[j])) {
      const lastVowel = prev.findLastIndex(isVowel);
      const coda = prev.slice(lastVowel + 1);
      if (lastVowel >= 0 && coda.length) {
        const take = onsetLength(coda);
        out[out.length - 1] = prev.slice(0, prev.length - take);
        out.push([...coda.slice(coda.length - take), 'ə']);
        continue;
      }
    }
    if (pi >= phonetic.length) return null;
    out.push(phonetic[pi++]);
  }
  return pi === phonetic.length ? out : null;
}

/**
 * Sépare le déterminant du mot dans la sortie brute du phonémiseur.
 * La consonne de liaison passe au mot : « les amis » → le | za-mi, « un éléphant » → un | né-lé-phant.
 */
export function splitDeterminerPhones(raw: string[]): { determiner: string[]; word: string[] } {
  const space = raw.indexOf(' ');
  if (space < 0) return { determiner: [], word: cleanPhones(raw) };
  const head = raw.slice(0, space);
  const dash = head.indexOf('-');
  let determiner = cleanPhones(dash >= 0 ? head.slice(0, dash) : head);
  let liaison = dash >= 0 ? cleanPhones(head.slice(dash + 1)) : [];
  const word = cleanPhones(raw.slice(space + 1));
  if (!liaison.length && word.length && isVowel(word[0]) && determiner.length > 1 && determiner.at(-1) === 'n' && determiner.at(-2)!.endsWith(NASAL)) {
    liaison = ['n'];
    determiner = determiner.slice(0, -1);
  }
  return { determiner, word: [...liaison, ...word] };
}

/**
 * Les unités à prononcer une à une pour un mot : déterminant éventuel, puis une
 * unité par syllabe écrite. null si l'alignement échoue (pas de son syllabé).
 */
export function spokenUnits(raw: string[], determiner: string | undefined, syllables: string[]): string[][] | null {
  const det = determiner?.trim() ?? '';
  const separate = !!det && !/['’]$/.test(det); // « l' » se colle à la première syllabe
  const { determiner: detPhones, word } = separate ? splitDeterminerPhones(raw) : { determiner: [], word: cleanPhones(raw) };
  if (separate && !detPhones.length) return null;
  const aligned = alignToWritten(syllables, phoneticSyllables(word));
  if (!aligned || aligned.some((u) => !u.length)) return null;
  return separate ? [detPhones, ...aligned] : aligned;
}

/** Ajoute l'accent tonique devant la voyelle : une syllabe isolée se prononce pleinement. */
export function stressed(unit: string[]): string[] {
  const v = unit.findIndex((p) => isVowel(p) && p !== 'ə');
  return v < 0 ? unit : [...unit.slice(0, v), 'ˈ', ...unit.slice(v)];
}
