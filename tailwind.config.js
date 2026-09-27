/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F1EDE4",
        card: "#FAF8F3",
        ink: "#211F1B",
        muted: "#726C5F",
        line: "#DAD3C2",
        moss: {
          DEFAULT: "#5B6A4C",
          dark: "#455038",
          light: "#EDF0E6",
        },
        clay: {
          DEFAULT: "#B0602F",
          light: "#F6E8DD",
        },
        sky: {
          DEFAULT: "#3B6EA5",
          light: "#E4EBF3",
        },
        rose: {
          DEFAULT: "#A53B3B",
          light: "#F3E2E2",
        },
        amber: {
          DEFAULT: "#A6791F",
          light: "#F5EBD3",
        },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
