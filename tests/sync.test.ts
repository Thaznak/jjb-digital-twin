import { codeSync } from '../src/data/sync';

describe('partage par code (V1)', () => {
  const me = { id: 'p-abc', name: 'Lou', color: '#5FB3D9', favorites: ['1-ms1-1260', '1-altar-1320'] };

  it('fait un aller-retour par lien', () => {
    const link = codeSync.share(me, 'https://exemple.test/app/');
    expect(link.startsWith('https://exemple.test/app/#ami=HF1.')).toBe(true);
    expect(codeSync.receive(link)).toEqual(me);
  });

  it('accepte le code seul', () => {
    const code = codeSync.share(me, '').slice(5);
    expect(codeSync.receive(code).favorites).toEqual(me.favorites);
  });

  it('ne se met pas à jour tout seul', async () => {
    expect(codeSync.live).toBe(false);
    expect(await codeSync.pull()).toEqual([]);
  });
});
