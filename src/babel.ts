import * as b from "@babel/core";
import * as t from "@babel/types";

export interface State {
    isTestLike: boolean;
    mockedPaths: string[];
}

export interface Options {
    mockExternalIdentifier?: string;
    alwaysMockIdentifiers?: string[];
}

export default function plugin({ types: t, template: tmpl }: typeof b, options: Options = {}): b.PluginObj<State> {

    const mockExternalIdentifier = options.mockExternalIdentifier || "mockExternalComponents";

    const getMostLeftIdentifier = (exp: t.Node): t.Identifier | undefined => {
        if (!t.isMemberExpression(exp)) {
            return;
        }
        if (t.isIdentifier(exp.object)) {
            return exp.object;
        }
        return getMostLeftIdentifier(exp.object);
    }

    const mockHelper = tmpl(`
    (function() {
        const { mockExternalComponents } = jest.requireActual("jest-mock-external-components");
        mockExternalComponents(COMPONENT_PATH, TEST_PATH);
    })();
    `, { placeholderPattern: false, placeholderWhitelist: new Set(["COMPONENT_PATH", "TEST_PATH"]) } as any);
    return {
        pre() {
            this.isTestLike = false;
            this.mockedPaths = [];
            // this.mockedIdentifiers = [];
        },
        visitor: {
            ImportDeclaration(path) {
                if (path.node.source.value === "jest-mock-external-components") {
                    path.remove();
                }
            },
            CallExpression(path, state) {
                if (t.isIdentifier(path.node.callee) && path.node.callee.name === mockExternalIdentifier) {
                    this.isTestLike = true;
                    if (!path.parentPath.isExpressionStatement()) {
                        return;
                    }
                    if (!path.scope.path.isProgram()) {
                        return;
                    }

                    // substitute expression
                    const firstArg = path.node.arguments[0];
                    if (!t.isIdentifier(firstArg) && !t.isMemberExpression(firstArg)) {
                        throw new Error(`Invalid argument passed to ${mockExternalIdentifier}`);
                    }
                    const firstArgIdentifier = t.isMemberExpression(firstArg) ? getMostLeftIdentifier(firstArg) : firstArg;
                    if (!firstArgIdentifier) {
                        return;
                    }
                    const firstArgIdentifierName = firstArgIdentifier.name;
                    const binding = path.scope.getBinding(firstArgIdentifierName);
                    if (!binding || binding.kind !== "module") {
                        return;
                    }
                    const modulePath = (binding.path.parent as t.ImportDeclaration).source.value;
                    if (this.mockedPaths.includes(modulePath)) {
                        path.parentPath.remove();
                        return;
                    }

                    path.parentPath.replaceWith(mockHelper({
                        COMPONENT_PATH: t.stringLiteral(modulePath),
                        TEST_PATH: t.stringLiteral(state.filename || ""),
                    }) as any);
                    this.mockedPaths.push(modulePath);

                    (path.parentPath.node as any)._blockHoist = 4;
                }
            },
        }
    }
}