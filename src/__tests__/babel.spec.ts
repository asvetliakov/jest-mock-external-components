import plugin from "../babel";
import { transform } from "@babel/core";

it("Process mockExternalComponents call", () => {
    const source = `
            import A from "../a";
            import { B } from "b";
            import * as C from "../../c";
            import render from "renderer";
            import { mockExternalComponents } from "jest-mock-external-components";

            mockExternalComponents(A);
            mockExternalComponents(B);
            mockExternalComponents(C.C1);

            it("test", () => {
                expect(render(<A />)).toMatchSnapshot();
            });
        `;
    expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"], filename: "/test.jsx" })!.code).toMatchSnapshot();
    expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "/test.jsx" })!.code).toMatchSnapshot();
});

it("Works for 2 identifiers from same file", () => {
    const source = `
            import A, { B, C, D } from "../a";
            import mockExternalComponents from "jest-mock-external-components";

            mockExternalComponents(A);
            mockExternalComponents(B);
            mockExternalComponents(C.C1);

            it("test", () => {
                expect(render(<A />)).toMatchSnapshot();
            });
        `;
    expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"], filename: "/test.jsx" })!.code).toMatchSnapshot();
    expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "/test.jsx" })!.code).toMatchSnapshot();
});

it("Throws error for non identifier", () => {
    const source = `
            import A from "../a";
            import mockExternalComponents from "jest-mock-external-components";

            mockExternalComponents({});

            it("test", () => {
                expect(render(<A />)).toMatchSnapshot();
            });
        `;
    expect(() => transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] })).toThrowErrorMatchingSnapshot();
    expect(() => transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "/test.jsx" })).toThrowErrorMatchingSnapshot();
});

it("Does not do anything for non imported identifier", () => {
    const source = `
            import A from "../a";
            import mockExternalComponents from "jest-mock-external-components";

            const B = {};

            mockExternalComponents(A);
            mockExternalComponents(B);

            it("test", () => {
                expect(render(<A />)).toMatchSnapshot();
            });
        `;
    expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"], filename: "/test.jsx" })!.code).toMatchSnapshot();
    expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "/test.jsx" })!.code).toMatchSnapshot();

});