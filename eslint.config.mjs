export default defineConfig([
    globalIgnores(["**/dist", "**/node_modules"]),
    {
      extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
        "plugin:prettier/recommended",
      ),
  
      plugins: {
        "@typescript-eslint": typescriptEslint,
        prettier,
      },
  
      languageOptions: {
        globals: { ...globals.node },
        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: "module",
        parserOptions: { project: "./tsconfig.json" },
      },
  
      rules: {
        // 1. Turn off ESLint’s built‑in indent rule:
        "indent": "off",
  
        // 2. Tell eslint-plugin-prettier to enforce your space‑based settings:
        "prettier/prettier": [
          "error",
          {
            useTabs: false,
            tabWidth: 2,
            singleQuote: true,
            trailingComma: "all",
            arrowParens: "always",
            printWidth: 100,
            semi: true
          }
        ],
  
        "@typescript-eslint/no-unused-vars": ["warn", {
          argsIgnorePattern: "^_",
        }],
      },
    },
  ]);
  