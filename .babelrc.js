const env = process.env.BABEL_ENV || process.env.NODE_ENV;

const config = {
    presets: [
        "@babel/typescript",
        ["@babel/env", {
            targets: {
                node: "10"
            },
            modules: "commonjs",
        }],
    ],
};

module.exports = config;