import { plugin as shadcn } from "@shadcn/lint";
import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { shadcn },
    rules: {
      "shadcn/no-restyle": ["error", { allow: ["layout"] }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "components/ui/**",
    "hooks/use-mobile.ts",
    "public/deepfilternet/**",
  ]),
]);

export default eslintConfig;
