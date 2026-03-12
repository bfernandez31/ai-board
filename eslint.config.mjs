import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "build/",
      "dist/",
      "coverage/",
      "*.min.js",
      "test-results/",
      "playwright-report/",
      "blob-report/",
      "*.tsbuildinfo",
      "next-env.d.ts",
      "mcp-server/",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Many legitimate patterns (localStorage reads, browser API checks after mount)
      // TODO: refactor these patterns incrementally, then re-enable as "error"
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  eslintConfigPrettier,
];

export default eslintConfig;
