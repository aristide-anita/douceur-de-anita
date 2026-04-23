/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFFBF5',
        'dusty-pink': '#E9A4A0',
        caramel: '#C5A880',
        'warm-brown': '#3D2C1F',
        'soft-taupe': '#EFE3D0',
        'success-green': '#8FBC94',
        'alert-red': '#D47B7B',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 4px 20px -4px rgba(61, 44, 31, 0.08)',
        'soft-lg': '0 10px 30px -6px rgba(61, 44, 31, 0.12)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
