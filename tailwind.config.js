/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2E4A3F',
          50:  '#EFF4F2',
          100: '#D4E3DC',
          200: '#A9C7BA',
          500: '#2E4A3F',
          600: '#243C32',
          700: '#1A2E25',
        },
        accent: {
          DEFAULT: '#C45A28',
          50:  '#FBF1EB',
          100: '#F3D4C0',
          500: '#C45A28',
          600: '#A34A20',
          700: '#823A18',
        },
        warm: {
          50:  '#F9F7F4',
          100: '#F2EEE8',
          200: '#E5E0D8',
          300: '#D4CCC0',
          700: '#5C5649',
          900: '#1A1916',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
    },
  },
  plugins: [],
};
