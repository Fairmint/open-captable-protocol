import globals from "globals";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";

export default [
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
    },
    js.configs.recommended,
    prettier,
    {
        ignores: [".history", "node_modules", "dist"],
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-console": ["warn", { allow: ["warn", "error", "log"] }],
        },
    },
];
