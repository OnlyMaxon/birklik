/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        birklik: {
          primary: '#6e5436',
          'primary-light': '#9b7448',
          'primary-dark': '#4c3a25',
          accent: '#b7925d',
          'accent-light': '#d6b17d',
          'accent-dark': '#8a673c',
          'n-50': '#faf6f0',
          'n-100': '#f3ebe0',
          'n-200': '#e7dac8',
          'n-300': '#d2bea2',
          'n-400': '#b29c82',
          'n-500': '#8c7a66',
          'n-600': '#6f5f4c',
          'n-700': '#5c4a36',
          'n-800': '#463524',
          'n-900': '#342719'
        }
      },
      borderRadius: {
        'airbnb': '30px'
      },
      boxShadow: {
        'airbnb': '0 12px 28px rgba(58, 43, 27, 0.14)'
      }
    }
  },
  plugins: []
}
