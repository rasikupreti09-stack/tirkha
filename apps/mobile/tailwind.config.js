const { colors, radius } = require("@tirkha/shared/tokens");
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {
    colors,
    borderRadius: Object.fromEntries(Object.entries(radius).map(([key, value]) => [key, `${value}px`])),
  } },
  plugins: [],
};
