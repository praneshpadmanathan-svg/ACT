import { describe, expect, it } from 'vitest';
import { hrefFor, parseRoute } from './router';

describe('shared and saved routes', () => {
  it('recovers from malformed encoded links without crashing the app', () => {
    for (const path of ['notes/%', 'zone/%E0%A4%A', '%ZZ']) {
      expect(parseRoute(path)).toEqual({ name: 'landing' });
    }
  });
  it('preserves valid topic links and legacy study links', () => {
    const route = { name: 'drill', section: 'math', topic: 'Ratios & rates' } as const;
    expect(parseRoute(hrefFor(route).slice(2))).toEqual(route);
    expect(parseRoute('map/english')).toEqual({ name: 'path', section: 'english' });
  });
});
