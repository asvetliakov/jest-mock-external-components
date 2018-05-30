module.exports = {
    resetMocks: true,
    transform: {
        "\\.(ts|tsx)": "babel-jest",
    },
    testMatch: [
        "**/__tests__/**/*.ts?(x)",
        "**/?(*.)([Ss]pec|[Tt]est).ts?(x)",
        "**/*_([Ss]pec|[Tt]est).ts?(x)",
    ],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/dist/",
        "/fixtures/",
    ],
    moduleFileExtensions: [
        "ts",
        "js",
        "tsx"
    ],
}