/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // Не через extend: иначе стек sans смержится с ui-sans-serif и останется системный шрифт
    fontFamily: {
      sans: ['Unbounded', 'system-ui', 'sans-serif'],
      mono: ['Unbounded', 'ui-monospace', 'monospace'],
    },
    extend: {},
  },
  plugins: [],
};
