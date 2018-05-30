import path from "path";

export interface TestMockDefinition {
    /**
     * Import path of component
     */
    path: string;
    /**
     * Component identifier or namespace identifier
     */
    identifier: string;
    /**
     * Import type for identifier
     */
    type: "default" | "name" | "namespace";
    /**
     * Absolute path to file
     */
    fullPath: string;
}

export function mockExternalComponents(component: any, definition?: TestMockDefinition): any {
    if (!definition) {
        throw new Error("Babel plugin of \"jest-mock-external-components\" is not enabled");
    }
    const { path: relativePathFromTest, identifier, type, fullPath: testPath } = definition;
    if (!testPath) {
        throw new Error("No test file path");
    }

    const fullPath = path.join(path.dirname(testPath), relativePathFromTest);
    const mockDefinitions: Array<{ path: string; definition: any }> = [];

    try {
        const main = require(fullPath);
        const mocks: TestMockDefinition[] = main["Mocks"];
        if (!mocks) {
            return;
        }
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
            const mainDirPath = path.dirname(fullPath);

            // if mock is relative path then calculate properly path based on test path directory
            let newPath = mockPath.startsWith(".") ? path.join(mainDirPath, mockPath) : mockPath;
            if (flattenMocks[mockPath] && flattenMocks[mockPath].length) {
                // const newPath = path.join(mainDirPath, mock.path);
                mockDefinitions.push({
                    path: newPath,
                    definition: () => {
                        const actual = require.requireActual(newPath);
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
                                mockedModule = mock.identifier;
                                delete mockedModule["__esModule"];
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
                    }
                });
            }
        }
        jest.resetModules();
    } catch { /* ignore */ }
    return mockDefinitions;
}

export default mockExternalComponents;