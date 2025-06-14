import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
    {
        files: ["**/*.{js,ts,mjs,mts}"],
        ignores: ["node_modules/**", "eslint.config.js", "src/chain-operations/canton/lib/**"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            import: importPlugin,
        },
        rules: {
            ...js.configs.recommended.rules,
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-console": ["warn", { allow: ["warn", "error", "log"] }],
            "import/no-unresolved": "error",
            "import/named": "error",
            "import/default": "error",
            "import/namespace": "error",
        },
        settings: {
            "import/resolver": {
                node: {
                    extensions: [".js", ".ts", ".json"],
                    moduleDirectory: ["node_modules", "."],
                    paths: ["node_modules"],
                },
            },
        },
    },
    {
        files: ["**/*.ts"],
        ignores: ["node_modules/**", "src/chain-operations/canton/lib/**"],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: "./tsconfig.json",
                ecmaVersion: 2022,
                sourceType: "module",
                ecmaFeatures: {
                    modules: true,
                },
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/ban-ts-comment": "off",
        },
    },
];
