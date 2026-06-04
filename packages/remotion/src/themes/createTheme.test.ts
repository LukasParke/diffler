import {describe, it, expect} from 'vitest';
import {createTheme} from './createTheme';
import {defaultTheme} from './default';

describe('createTheme', () => {
  it('returns base theme when no overrides', () => {
    const theme = createTheme(defaultTheme);
    expect(theme.colors.green).toBe(defaultTheme.colors.green);
  });

  it('merges color overrides', () => {
    const theme = createTheme(defaultTheme, {
      colors: {green: '#00ff00'},
    });
    expect(theme.colors.green).toBe('#00ff00');
    expect(theme.colors.blue).toBe(defaultTheme.colors.blue);
  });

  it('merges radii overrides', () => {
    const theme = createTheme(defaultTheme, {radii: {card: '8px'}});
    expect(theme.radii.card).toBe('8px');
    expect(theme.radii.panel).toBe(defaultTheme.radii.panel);
  });

  it('merges typography overrides', () => {
    const theme = createTheme(defaultTheme, {
      typography: {fontFamily: 'Arial'},
    });
    expect(theme.typography.fontFamily).toBe('Arial');
  });

  it('does not mutate unmodified keys', () => {
    const theme = createTheme(defaultTheme, {
      colors: {green: '#00ff00'},
    });
    expect(theme.radii).toEqual(defaultTheme.radii);
    expect(theme.typography).toEqual(defaultTheme.typography);
  });
});
