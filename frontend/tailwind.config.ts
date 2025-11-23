import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        shamrock: "#15C27C",
        shamrockDark: "#0F8F58",
        tangerine: "#FF8D5B",
        mist: "#F4F7F7",
        mint: "#E1F7EF",
        clay: "#E8ECEF",
        forest: "#0E1B1A",
      },
      boxShadow: {
        card: "0 12px 35px rgba(15, 84, 64, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;

