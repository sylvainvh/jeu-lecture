import { describe, expect, it } from 'vitest';
import { spokenUnits } from './phonemes';

/** Sorties réelles de piper_phonemize (voix française). */
const cases: [string, string | undefined, string[], string, string][] = [
  ['la maison', 'la', ['mai', 'son'], 'l a - | m ɛ z ˈ ɔ ̃', 'la mɛ zɔ̃'],
  ['un squelette', 'un', ['sque', 'let', 'te'], 'œ ̃ | s k ə l ˈ ɛ t', 'œ̃ skə lɛ tə'],
  ['châtaigne', undefined, ['châ', 'tai', 'gne'], 'ʃ a t ˈ ɛ ɲ', 'ʃa tɛ ɲə'],
  ['hiver', undefined, ['hi', 'ver'], 'i v ˈ ɛ ʁ', 'i vɛʁ'],
  ["l'hiver", "l'", ['hi', 'ver'], 'l i v ˈ ɛ ʁ', 'li vɛʁ'],
  ['un éléphant', 'un', ['é', 'lé', 'phant'], 'œ ̃ n | e l e f ˈ ɑ ̃', 'œ̃ ne le fɑ̃'],
  ['les amis', 'les', ['a', 'mis'], 'l e - z | a m ˈ i', 'le za mi'],
  ['une chauve-souris', 'une', ['chau', 've-', 'sou', 'ris'], 'y n | ʃ ˈ o v s u ʁ ˈ i', 'yn ʃo və su ʁi'],
  ['la grenouille', 'la', ['gre', 'nouil', 'le'], 'l a - | ɡ ʁ ə n ˈ u j', 'la ɡʁə nu jə'],
  ['le papillon', 'le', ['pa', 'pil', 'lon'], 'l ə - | p a p i j ˈ ɔ ̃', 'lə pa pi jɔ̃'],
  ['arbre', undefined, ['ar', 'bre'], 'ˈ a ʁ b ʁ', 'aʁ bʁə'],
  ['école', undefined, ['é', 'co', 'le'], 'e k ˈ ɔ l', 'e kɔ lə'],
  ['la nuit', 'la', ['nuit'], 'l a - | n y ˈ i', 'la nɥi'],
  ['une pomme de terre', 'une', ['pom', 'me ', 'de ', 'ter', 're'], 'y n | p ˈ ɔ m | d ə - | t ˈ ɛ ʁ', 'yn pɔ mə də tɛ ʁə'],
  ['le train', 'le', ['train'], 'l ə - | t ʁ ˈ ɛ ̃', 'lə tʁɛ̃'],
  ['escargot', undefined, ['es', 'car', 'got'], 'ɛ s k a ʁ ɡ ˈ o', 'ɛs kaʁ ɡo'],
];
const raw = (s: string) => s.split(' ').map((p) => (p === '|' ? ' ' : p));

describe('spokenUnits', () => {
  it.each(cases)('%s', (_text, det, syllables, phones, expected) => {
    expect(spokenUnits(raw(phones), det, syllables)?.map((u) => u.join('')).join(' ')).toBe(expected);
  });
  it("renonce quand les syllabes écrites et prononcées ne s'accordent pas", () => {
    expect(spokenUnits(raw('l j ˈ ɔ ̃'), undefined, ['li', 'on'])).toBeNull();
  });
});
