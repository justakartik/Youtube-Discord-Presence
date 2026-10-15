import tseslint from "typescript-eslint";
export default [
  { ignores: ["**/dist/**", "release/**", "node_modules/**", "**/*.mjs"] },
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-expressions": "off" } },
];
