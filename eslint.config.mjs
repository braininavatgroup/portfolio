import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    ".context/**",
    ".wrangler/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  eslint.configs.recommended,
  // Type-aware, not just syntactic. Without this, no-floating-promises,
  // no-misused-promises and await-thenable are all off — in a Worker codebase
  // dense with void-ed promises and AbortSignal plumbing.
  ...tseslint.configs.recommendedTypeChecked,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    // recommendedTypeChecked brings the rules that catch real defects here —
    // floating promises, misused promises, await-thenable — plus a large family
    // of no-unsafe-* rules aimed at `any`-heavy code. This codebase has zero
    // `any` in source; those rules fire almost entirely on test mocks and
    // Reflect.get boundaries, where the looseness is deliberate. Off, so the
    // signal is not buried. require-await and unbound-method are style.
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    // Fire-and-forget is idiomatic in these tests — they drive async machinery
    // and assert on its observable effects rather than on the promise. Warn so
    // the count stays visible; error in production code, where a floating
    // promise is how a rejection gets swallowed.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-base-to-string": "warn",
    },
  },
  {
    files: [
      "app/design/three-fixtures.tsx",
      "app/design/sheet-examples.tsx",
      "components/scene/**/*.tsx",
      "components/avatar/**/*.tsx",
    ],
    rules: {
      "react/no-unknown-property": "off",
    },
  },
  {
    files: ["**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
]);

export default eslintConfig;
