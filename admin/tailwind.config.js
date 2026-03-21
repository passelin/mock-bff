export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#8b5cf6', 600: '#7c3aed' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139,92,246,.35), 0 8px 40px rgba(0,0,0,.45)',
      },
    },
  },
  plugins: [],
};
