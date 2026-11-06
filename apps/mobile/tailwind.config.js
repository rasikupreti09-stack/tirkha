const { colors, radius } = require("@tirkha/shared/tokens");
module.exports = {
  // Resolve globs from this file, not the process working directory. EAS and
  // local builds can invoke Tailwind from different directories.
  content: {
    relative: true,
    files: [
      "./*.{js,jsx,ts,tsx}",
      "./app/**/*.{js,jsx,ts,tsx}",
      "./components/**/*.{js,jsx,ts,tsx}",
      "./providers/**/*.{js,jsx,ts,tsx}",
      "./hooks/**/*.{js,jsx,ts,tsx}",
      "./lib/**/*.{js,jsx,ts,tsx}",
      "../../packages/shared/src/**/*.{js,jsx,ts,tsx}",
    ],
  },
  presets: [require("nativewind/preset")],
  theme: { extend: {
    colors,
    borderRadius: Object.fromEntries(Object.entries(radius).map(([key, value]) => [key, `${value}px`])),
  } },
  plugins: [],
};
