import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "raw-data/**", "data/**", "output/**", ".playwright-cli/**"] },
  { files: ["**/*.{js,mjs,vue}"], rules: js.configs.recommended.rules },
  ...vue.configs["flat/essential"],
  { files: ["src/**/*.{js,vue}"], languageOptions: { globals: globals.browser } },
  { files: ["*.{js,mjs}", "scripts/**/*.mjs", "tests/**/*.js"], languageOptions: { globals: globals.node } },
  { files: ["tests/**/*.js"], languageOptions: { globals: globals.browser } },
];
