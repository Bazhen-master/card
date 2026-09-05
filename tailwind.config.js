/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        cardBg: "#f7f3ec",
        accent: "#8a4baf",
      },
    },
  },
  plugins: [],
};
