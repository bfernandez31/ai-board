import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Catppuccin Mocha colors (prefixed with ctp- to avoid conflicts with Tailwind defaults)
        'ctp-base': 'hsl(var(--ctp-base))',
        'ctp-mantle': 'hsl(var(--ctp-mantle))',
        'ctp-crust': 'hsl(var(--ctp-crust))',
        'ctp-surface0': 'hsl(var(--ctp-surface-0))',
        'ctp-surface1': 'hsl(var(--ctp-surface-1))',
        'ctp-surface2': 'hsl(var(--ctp-surface-2))',
        'ctp-text': 'hsl(var(--ctp-text))',
        'ctp-subtext0': 'hsl(var(--ctp-subtext-0))',
        'ctp-subtext1': 'hsl(var(--ctp-subtext-1))',
        'ctp-overlay0': 'hsl(var(--ctp-overlay-0))',
        'ctp-lavender': 'hsl(var(--ctp-lavender))',
        'ctp-blue': 'hsl(var(--ctp-blue))',
        'ctp-sapphire': 'hsl(var(--ctp-sapphire))',
        'ctp-sky': 'hsl(var(--ctp-sky))',
        'ctp-teal': 'hsl(var(--ctp-teal))',
        'ctp-green': 'hsl(var(--ctp-green))',
        'ctp-yellow': 'hsl(var(--ctp-yellow))',
        'ctp-peach': 'hsl(var(--ctp-peach))',
        'ctp-maroon': 'hsl(var(--ctp-maroon))',
        'ctp-red': 'hsl(var(--ctp-red))',
        'ctp-mauve': 'hsl(var(--ctp-mauve))',
        'ctp-pink': 'hsl(var(--ctp-pink))',
        'ctp-flamingo': 'hsl(var(--ctp-flamingo))',
        'ctp-rosewater': 'hsl(var(--ctp-rosewater))',
        // Legacy aliases for backward compatibility (timeline components)
        base: 'hsl(var(--ctp-base))',
        mantle: 'hsl(var(--ctp-mantle))',
        surface0: 'hsl(var(--ctp-surface-0))',
        text: 'hsl(var(--ctp-text))',
        subtext0: 'hsl(var(--ctp-subtext-0))',
        subtext1: 'hsl(var(--ctp-subtext-1))',
        surface2: 'hsl(var(--ctp-surface-2))',
        lavender: 'hsl(var(--ctp-lavender))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
export default config
