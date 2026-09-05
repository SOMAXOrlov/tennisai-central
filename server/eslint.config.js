// ESLint flat config for the API. Mirrors the frontend's eslint.config.js
// (same @eslint/js + typescript-eslint recommended sets) minus the React
// plugins, with Node globals instead of browser ones.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "prisma/migrations"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      // Grouped `case` labels are separated by a comment explaining the
      // grouping (notifications/deliver.ts). The rule's default only tolerates
      // an empty case when the next label is on the very next line; the comment
      // is exactly what that layout heuristic exists to prompt for.
      "no-fallthrough": ["error", { allowEmptyCase: true }],
    },
  },
);
