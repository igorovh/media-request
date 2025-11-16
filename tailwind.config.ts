import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#9147ff',
          dark: '#7b2cbf',
          light: '#c77dff',
        },
        text: {
          light: '#ffffff',
          gray: '#b8b8b8',
        },
        background: {
          darker: '#0a0a0a',
          dark: '#121212',
        },
        card: {
          bg: '#1e1e1e',
          hover: '#252525',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        sans: ['Mulish', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 10px 30px rgba(0, 0, 0, 0.2)',
        'primary': '0 8px 25px rgba(145, 71, 255, 0.5)',
        'input-focus': '0 0 0 3px rgba(145, 71, 255, 0.25)',
      },
    },
  },
  plugins: [],
}
export default config

