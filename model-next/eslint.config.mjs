import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { plugin as shadcn } from "@shadcn/lint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ["**/*.{js,jsx,ts,tsx}"],

    plugins: {
      shadcn,
    },

    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-empty-object-type": "off",

      // React
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",

      // shadcn
      "shadcn/no-restyle": ["warn", { allow: ["layout"] }],
      "shadcn/no-raw-colors": "warn",
      "shadcn/no-arbitrary-values": ["warn", { allow: ["layout"] }],
      "shadcn/no-inline-styles": "warn",
      "shadcn/no-unknown-classes": "warn",
      "shadcn/require-static-classes": "warn",
    },
  },

  // shadcn UI components are allowed to define their own styling.
  {
    files: ["components/ui/**/*.{js,jsx,ts,tsx}"],
    rules: {
     "shadcn/no-restyle": "off",
      "shadcn/no-raw-colors": "off",
      "shadcn/no-arbitrary-values":  "off",
      "shadcn/no-inline-styles":  "off",
      "shadcn/no-unknown-classes":  "off",
      "shadcn/require-static-classes": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;