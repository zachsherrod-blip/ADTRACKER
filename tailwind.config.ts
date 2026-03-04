import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0eaff",
          500: "#4f6ef7",
          600: "#3d5ce8",
          700: "#2e4bd4",
        },
      },
    },
  },
  plugins: [],
};
export default config;
