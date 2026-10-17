/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Apple "grouped" surfaces: light gray canvas, white cards.
        paper: "#F5F5F7",
        card: "#FFFFFF",
        ink: "#1D1D1F",
        muted: "#6E6E73",
        line: "#E3E3E8",
        // NOTE: `moss` is the app's primary ACCENT token (kept under its
        // original name so no class names change) — now Apple blue.
        moss: {
          DEFAULT: "#0071E3",
          dark: "#0058B9",
          light: "#E8F1FC",
        },
        // Semantic success (Delivered / Paid / positive) — Apple green.
        success: {
          DEFAULT: "#34C759",
          dark: "#1F7A34",
          light: "#E8F8EC",
        },
        clay: {
          DEFAULT: "#C75B00", // warning / low stock — Apple orange (text-safe)
          light: "#FFF1E3",
        },
        sky: {
          DEFAULT: "#5856D6", // info — Apple indigo
          light: "#EEEDFB",
        },
        rose: {
          DEFAULT: "#D70015", // error / destructive — Apple red (text-safe)
          light: "#FFECEA",
        },
        amber: {
          DEFAULT: "#8F6A00",
          light: "#FFF6D9",
        },
      },
      // System font first (SF Pro on Apple devices); Inter is the closest
      // match everywhere else. One family for everything — hierarchy comes
      // from weight, size and tracking, not a decorative serif.
      fontFamily: {
        display: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter",
          "system-ui", "sans-serif",
        ],
        sans: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter",
          "system-ui", "sans-serif",
        ],
        mono: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter",
          "system-ui", "sans-serif",
        ],
      },

      // Slightly larger, softer corners — applied uniformly to every
      // rounded-md / rounded-lg already in the app.
      borderRadius: {
        md: "0.625rem",
        lg: "0.875rem",
      },

      // Layered, low-contrast shadows. Bigger surfaces read as thicker.
      boxShadow: {
        sm: "0 1px 2px rgb(0 0 0 / 0.05), 0 4px 12px -2px rgb(0 0 0 / 0.06)",
        card: "inset 0 1px 0 rgb(255 255 255 / 0.55), 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 20px -10px rgb(0 0 0 / 0.10)",
        xl: "inset 0 1px 0 rgb(255 255 255 / 0.6), 0 2px 6px rgb(0 0 0 / 0.06), 0 24px 56px -12px rgb(0 0 0 / 0.30)",
      },

      // Spring-like curves. `spring` is critically damped (no overshoot);
      // `spring-bounce` overshoots slightly and is for momentum-driven motion.
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
        "spring-bounce": "cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(10px) scale(0.985)" },
        },
      },
      animation: {
        rise: "rise 520ms cubic-bezier(0.32, 0.72, 0, 1) backwards",
      },
    },
  },
  plugins: [],
};