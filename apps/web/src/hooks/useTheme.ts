import React from 'react'

const storageKey = 'quizlive-theme'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = React.useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey)
    return (stored as Theme) || 'light'
  })

  React.useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(storageKey, theme)
  }, [theme])

  return { theme, setTheme }
}
