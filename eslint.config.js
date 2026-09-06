import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `server/` is a separate npm package with its own tsconfig, Node globals and
  // `server/eslint.config.js`. Linting it from here applies browser globals and
  // the React rule set to Node code; `npm run lint` inside `server/` covers it
  // properly, and CI runs both.
  { ignores: ["dist", "server"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Fast-refresh granularity only, never correctness: the rule asks that a
      // module export components and nothing else. What it flags here is the
      // shadcn pattern (a component plus its cva variants in one file) and
      // every context module (provider plus its hook). Satisfying it means
      // splitting 13 shared files and rewriting each importer to make a
      // dev-server hot update slightly narrower.
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Test doubles are where `any` is the honest type: `vi.fn()` stubs, mock
    // factories standing in for a whole module, and `globalThis` polyfills all
    // describe shapes the real types deliberately do not have. Production code
    // stays under the rule.
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
