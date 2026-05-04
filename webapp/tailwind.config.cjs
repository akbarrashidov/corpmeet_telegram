const corpmeetPreset = require("@corpmeet/design/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [corpmeetPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    // Tailwind должен сканировать классы внутри дизайн-пакета,
    // иначе они не попадут в продакшен-CSS
    "../../docs/corpmeet_design/src/**/*.{ts,tsx}",
  ],
};
