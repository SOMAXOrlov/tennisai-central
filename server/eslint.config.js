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
      // Two deliberate-ignore conventions the rule's defaults reject.
      // `_`-prefixed names: Express only recognises a terminal error handler if
      // it declares all four parameters, so `_req`/`_next` must exist and must
      // go unused (http.ts). `ignoreRestSiblings`: publicUser.ts strips secrets
      // by destructuring them away from `...rest`, so naming `passwordHash` is
      // precisely how it is removed — the "unused" binding is the mechanism.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Same reasoning as the frontend config: test doubles are where `any` is
    // the honest type. drillSchema.test.ts deliberately mutates a valid
    // document into an invalid one, which no accurate type can describe.
    files: ["**/*.test.ts", "src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
