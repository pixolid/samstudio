import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeProvider() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('sam-studio-theme')
    return (stored as Theme) || 'dark'
  })

  const isDark = theme === 'dark'

  useEffect(() => {
    localStorage.setItem('sam-studio-theme', theme)
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme, isDark])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme, isDark }
}
