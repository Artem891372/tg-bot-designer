/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tg-bot-bubble-light': '#ffffff',
        'tg-bot-bubble-dark': '#1c1c1e',
        'tg-user-bubble-light': '#d7f0ff',
        'tg-user-bubble-dark': '#2a2a2e',
        'tg-text-light': '#000000',
        'tg-text-dark': '#ffffff',
        'tg-border-light': '#d9d9d9',
        'tg-border-dark': '#333333',
        'tg-button-light': '#f0f0f0',
        'tg-button-dark': '#3a3a3c',
      },
    },
  },
  plugins: [],
};