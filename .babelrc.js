const env = process.env.BABEL_ENV || process.env.NODE_ENV;

const config = {
    presets: [
        "@babel/typescript",
        "@babel/stage-3",
        ["@babel/env", {
            targets: {
                node: "8"
            },
            modules: "commonjs",
        }],
    ],
};

module.exports = config;