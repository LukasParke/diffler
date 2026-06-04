import {Theme} from './types';

export function createTheme(
  base: Theme,
  overrides: {
    colors?: Partial<Theme['colors']>;
    radii?: Partial<Theme['radii']>;
    typography?: Partial<Theme['typography']>;
  } = {},
): Theme {
  return {
    colors: {...base.colors, ...overrides.colors},
    radii: {...base.radii, ...overrides.radii},
    typography: {...base.typography, ...overrides.typography},
  };
}
