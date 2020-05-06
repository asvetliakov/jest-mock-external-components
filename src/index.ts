import path from "path";
import fs from "fs";
import { getMocks } from "./get_mocks";

export function mockExternalComponents(component: any): void;
export function mockExternalComponents(componentPath: string, testPath?: string): void {
    if (!componentPath || !testPath) {
        throw new Error("Either babel plugin \"jest-mock-external-components\" is not enabled or you passed non imported identifier to mockExternalComponents()");
    }
    let componentFullPath: string = "";
    const tryExt = [".tsx", ".ts", ".jsx", ".js"];
    if (tryExt.find(ext => componentFullPath.endsWith(ext))) {
        // import with extension
        try {
            componentFullPath = require.resolve(componentPath, {
                paths: [
                    path.dirname(testPath),
                ],
            });
        } catch {
            // ignore
        }
    } else {
        // try each extension
        for (const ext of tryExt) {
            try {
                componentFullPath = require.resolve(`${componentPath}${ext}`, { paths: [path.dirname(testPath)] });
            } catch {
                // ignore
            }
        }
    }
    if (!componentFullPath) {
        return;
    }

    const code = fs.readFileSync(componentFullPath, "utf8");
    if (!code) {
        return;
    }

    const mocks = getMocks(code, testPath.endsWith(".ts") || testPath.endsWith(".tsx") ? "typescript" : "flow");
    if (!mocks.length) {
        return;
    }

    try {
        // flat mocks by module path
        const flattenMocks = mocks.reduce((flattened, mock) => {
            const mockPath = mock.path;
            if (!flattened[mockPath]) {
                flattened[mockPath] = [];
            }
            flattened[mockPath].push({ identifier: mock.identifier, type: mock.type });
            return flattened;

        }, {} as { [key: string]: Array<{ identifier: string; type: "default" | "name" | "namespace" }> });
        for (const mockPath of Object.keys(flattenMocks)) {
            // path.dirname("..") and path.dirname("../") will result to "."
            // const mainDirPath = modulePath === "../" || modulePath === ".." ? modulePath : path.dirname(modulePath);
            const mainDirPath = path.dirname(componentFullPath);

            // if mock is relative path then calculate properly path based on test path directory
            let newPath = mockPath.startsWith(".") ? path.join(mainDirPath, mockPath) : mockPath;
            if (flattenMocks[mockPath] && flattenMocks[mockPath].length) {
                // const newPath = path.join(mainDirPath, mock.path);
                jest.doMock(newPath, () => {
                    const actual = jest.requireActual(newPath);
                    let mockedModule = { ...actual };
                    Object.defineProperty(mockedModule, "__esModule", { value: true });
                    const mocks = flattenMocks[mockPath];

                    for (const mock of mocks) {
                        const mockIdentifiers = mock.identifier.split(".");
                        // drop first identifier for namespace
                        if (mock.type === "namespace") {
                            mockIdentifiers.shift();
                        }
                        // import * as Comp from "./comp"; commonjs module.exports = ReactComp;
                        if (!mockIdentifiers.length && mock.type === "namespace") {
                            delete mockedModule["__esModule"];
                            mockedModule = mock.identifier;
                            // Bail
                            break;
                        }

                        if (mock.type === "default") {
                            mockedModule["default"] = mock.identifier;
                        } else {
                            const mostRightIdentifier = mockIdentifiers.pop();
                            if (!mostRightIdentifier) {
                                continue;
                            }
                            if (!mockIdentifiers.length) {
                                // top-level export
                                mockedModule[mostRightIdentifier] = mostRightIdentifier;
                            } else {
                                // sub-level export, i.e. import * as E; E.A.B; -> E dropped, A is sublevel export and B is identifier name
                                // import { A }; A.B -> A is sublevel export
                                let mockedPath = mockedModule;
                                while (mockIdentifiers.length > 0) {
                                    const subLevel = mockIdentifiers.shift()!;
                                    mockedPath[subLevel] = {
                                        ...actual[subLevel]
                                    };
                                    mockedPath = mockedPath[subLevel];
                                }
                                mockedPath[mostRightIdentifier] = mostRightIdentifier;
                            }
                        }
                    }
                    return mockedModule;
                });
            }
        }
    } catch { /* ignore */ }
}

export default mockExternalComponents;