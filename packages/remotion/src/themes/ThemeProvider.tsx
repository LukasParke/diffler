import React, {createContext, useContext} from 'react';
import {Theme} from './types';
import {defaultTheme} from './default';

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
