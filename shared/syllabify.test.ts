import { describe, expect, it } from 'vitest';
import { propose } from './syllabify';
import { colorRuns } from './coloring';

/** Notation de test : tirets entre syllabes, parenthèses autour des muettes. */
function show(text: string): string {
  const p = propose(text);
  let k = 0;
  const body = p.syllables
    .map((s) => [...s].map((c) => (p.silent[k++] ? `(${c})` : c)).join(''))
    .join('-');
  return (p.determiner ? p.determiner + ' + ' : '') + body;
}

describe('syllabify', () => {
  const cases: [string, string][] = [
    ['hiver', '(h)i-ver'],
    ['châtaigne', 'châ-tai-gne'],
    ['un squelette', 'un + sque-let-te'],
    ['chat', 'cha(t)'],
    ['maison', 'mai-son'],
    ['école', 'é-co-le'],
    ['arbre', 'ar-bre'],
    ['table', 'ta-ble'],
    ['pomme', 'pom-me'],
    ['éléphant', 'é-lé-phan(t)'],
    ['oiseau', 'oi-seau'],
    ['fille', 'fil-le'],
    ['soleil', 'so-leil'],
    ['feuille', 'feuil-le'],
    ['lion', 'lion'],
    ['nuit', 'nui(t)'],
    ['fruit', 'frui(t)'],
    ['théâtre', 't(h)é-â-tre'],
    ['grenouille', 'gre-nouil-le'],
    ['papillon', 'pa-pil-lon'],
    ['escargot', 'es-car-go(t)'],
    ['crayon', 'cra-yon'],
    ['poupée', 'pou-pée'],
    ['guitare', 'gui-ta-re'],
    ['automne', 'au-tom-ne'],
    ['champignon', 'cham-pi-gnon'],
    ['train', 'train'],
    ['souris', 'sou-ri(s)'],
    ['crier', 'cri-er'],
    ['oie', 'oie'],
    ['ours', 'ours'],
    ['temps', 'tem(p)(s)'],
    ["l'hiver", "l' + (h)i-ver"],
    ['la pomme de terre', 'la + pom-me -de -ter-re'],
    ['Noël', 'No-ël'],
  ];
  it.each(cases)('%s → %s', (input, expected) => {
    expect(show(input)).toBe(expected);
  });

  it('les syllabes redonnent toujours le mot', () => {
    for (const [input] of cases) {
      const p = propose(input);
      expect(p.silent.length).toBe([...p.syllables.join('')].length);
      expect((p.determiner ? p.determiner + (p.determiner.endsWith("'") ? '' : ' ') : '') + p.syllables.join('')).toBe(input);
    }
  });
});

describe('colorRuns', () => {
  const runs = (t: string) => colorRuns(propose(t)).map((r) => `${r.kind}:${r.text}`);
  it('hiver : h muet, i rouge, ver vert', () => {
    expect(runs('hiver')).toEqual(['silent:h', 'a:i', 'b:ver']);
  });
  it('châtaigne : rouge, vert, rouge', () => {
    expect(runs('châtaigne')).toEqual(['a:châ', 'b:tai', 'a:gne']);
  });
  it('un squelette : déterminant violet', () => {
    expect(runs('un squelette')).toEqual(['determiner:un ', 'a:sque', 'b:let', 'a:te']);
  });
  it("une syllabe entièrement muette n'avance pas l'alternance", () => {
    const r = colorRuns({ syllables: ['h', 'i', 'ver'], silent: [true, false, false, false, false] });
    expect(r.map((x) => `${x.kind}:${x.text}`)).toEqual(['silent:h', 'a:i', 'b:ver']);
  });
});
