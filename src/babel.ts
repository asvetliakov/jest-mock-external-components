import * as b from "@babel/core";
import * as t from "@babel/types";
import * as bt from "@babel/traverse";

export interface State {
    isTestLike: boolean;

    mockExpression?: t.ExportNamedDeclaration;

    mockedIdentifiers: string[];
}

export default function plugin({ types: t, template: tmpl }: typeof b, options: { mockExternalIdentifier?: string } = {}): b.PluginObj<State> {

    const mockExternalIdentifier = options.mockExternalIdentifier || "mockExternalComponents";

    const createNewIdentifierOrMemberExp = (node: t.Identifier | t.MemberExpression | t.JSXIdentifier | t.JSXMemberExpression): t.Identifier | t.MemberExpression => {
        if (t.isIdentifier(node) || t.isJSXIdentifier(node)) {
            return t.identifier(node.name);
        }
        return t.memberExpression(
            createNewIdentifierOrMemberExp(node.object as t.Identifier | t.MemberExpression),
            t.identifier((node.property as t.Identifier).name),
        );
    }
    const getMostLeftJSXIdentifier = (exp: t.JSXMemberExpression): t.JSXIdentifier => {
        if (t.isJSXIdentifier(exp.object)) {
            return exp.object;
        }
        return getMostLeftJSXIdentifier(exp.object);
    }
    const getMostLeftIdentifier = (exp: t.Node): t.Identifier | undefined => {
        if (!t.isMemberExpression(exp)) {
            return;
        }
        if (t.isIdentifier(exp.object)) {
            return exp.object;
        }
        return getMostLeftIdentifier(exp.object);
    }
    const getFullNameOfIdentifier = (exp: t.JSXMemberExpression | t.JSXIdentifier | t.Identifier | t.MemberExpression): string => {
        if (t.isIdentifier(exp) || t.isJSXIdentifier(exp)) {
            return exp.name;
        }
        return getFullNameOfIdentifier(exp.object as t.MemberExpression | t.Identifier) + `.${(exp.property as t.Identifier).name}`;
    }

    const processHocLikeCallExpression = (exp: t.CallExpression, scope: bt.Scope): [t.Identifier | t.MemberExpression | undefined, bt.Binding | undefined] => {
        if (!exp.arguments.length) {
            return [undefined, undefined];
        }
        // get first identifier or member exp, for HOC this is most common case, don't want to bother with anothers
        const firstArg: t.MemberExpression | t.Identifier | undefined = exp.arguments.find(a => t.isIdentifier(a) || t.isMemberExpression(a)) as any;
        if (!firstArg) {
            return [undefined, undefined];
        }
        const identifier = t.isIdentifier(firstArg) ? firstArg : getMostLeftIdentifier(firstArg);
        if (!identifier) {
            return [undefined, undefined];
        }
        const binding = scope.getBinding(identifier.name);
        if (!binding) {
            return [undefined, undefined];
        }
        if (binding.kind === "module") {
            // direct binding to module, return used binding
            return [firstArg, binding];
        } else {
            // import B;
            // const A = HOC(B);
            // const C = HOC(A);
            // <C />
            // need to process again
            if (!binding.path.isVariableDeclarator() || !(t.isTaggedTemplateExpression(binding.path.node.init) || t.isCallExpression(binding.path.node.init))) {
                return [undefined, undefined];
            }
            const init = binding.path.node.init;
            if (t.isTaggedTemplateExpression(init) && !t.isCallExpression(init.tag)) {
                return [undefined, undefined];
            }
            let callExp = t.isCallExpression(init) ? init : init.tag as t.CallExpression;
            // const A = (0, _someHOC)(_ImportedComponent)(" styles ") - often as result of styled components preprocessors
            if (t.isCallExpression(callExp.callee)) {
                callExp = callExp.callee;
            }
            return processHocLikeCallExpression(callExp, binding.path.scope);
        }
    }

    const mockHelper = tmpl(`
    (function() {
        const { mockExternalComponents } = require.requireActual("jest-mock-external-components");
        const mocks = mockExternalComponents({}, OBJECT_EXP);
        for (const mock of mocks) {
            jest.doMock(mock.path, mock.definition);
        }
    })();
    `, { placeholderPattern: false, placeholderWhitelist: new Set(["OBJECT_EXP"]) } as any);
    return {
        pre() {
            this.isTestLike = false;
            this.mockedIdentifiers = [];
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
                    const type = binding.path.isImportDefaultSpecifier() ? "default" : binding.path.isImportNamespaceSpecifier() ? "namespace" : "name";
                    const modulePath = (binding.path.parent as t.ImportDeclaration).source.value;
                    // remove old binding
                    // path.scope.removeBinding(firstArgIdentifierName);
                    // binding.path.remove();

                    // reset identifier in first arg
                    // path.node.arguments = [];
                    // path.node.arguments.push(t.objectExpression([]));

                    // add definition
                    const objExp = t.objectExpression([
                        t.objectProperty(t.identifier("identifier"), t.stringLiteral(firstArgIdentifierName)),
                        t.objectProperty(t.identifier("path"), t.stringLiteral(modulePath)),
                        t.objectProperty(t.identifier("type"), t.stringLiteral(type)),
                        t.objectProperty(t.identifier("fullPath"), t.stringLiteral(state.filename || "")),
                    ]);
                    path.parentPath.replaceWith(mockHelper({ OBJECT_EXP: objExp }));

                    // const variableDeclaration = t.variableDeclaration("const", [t.variableDeclarator(t.identifier(firstArgIdentifierName), path.node)]);
                    // path.parentPath.insertAfter(variableDeclaration);
                    (path.parentPath.node as any)._blockHoist = 4;
                    // path.parentPath.remove();
                    // const callExp = t.callExpression(t.identifier(mockExternalIdentifier), [
                    //     t.objectExpression([]),
                    //     t.objectExpression([
                    //         t.objectProperty(t.identifier("identifier"), t.stringLiteral(firstArgIdentifierName)),
                    //         t.objectProperty(t.identifier("path"), t.stringLiteral(modulePath)),
                    //         t.objectProperty(t.identifier("type"), t.stringLiteral(type)),
                    //     ]),
                    // ]);
                    // const st = t.expressionStatement(callExp);
                    // st.__blockHoist = Infinity;
                    // // (path.scope.path as bt.NodePath<t.Program>).unshiftContainer("body", st);
                    // path.scope.path.node.body.unshift(st);
                }
            },
            JSXOpeningElement(path) {
                if (this.isTestLike) {
                    return;
                }
                let identifierNode: t.MemberExpression | t.Identifier | t.JSXMemberExpression | t.JSXIdentifier | undefined;
                let identifierBinding: bt.Binding | undefined;
                // <A.B.C /> this can be mapped only to imported module
                if (t.isJSXMemberExpression(path.node.name)) {
                    const mostLeftIdentifier = getMostLeftJSXIdentifier(path.node.name);
                    const binding = path.scope.getBinding(mostLeftIdentifier.name);
                    if (!binding || binding.kind !== "module") {
                        return;
                    }
                    identifierNode = path.node.name;
                    identifierBinding = binding;
                } else if (t.isJSXIdentifier(path.node.name)) {
                    const identifier = path.node.name.name;
                    const binding = path.scope.getBinding(identifier);
                    if (!binding || (binding.kind !== "module" && binding.kind !== "const")) {
                        return;
                    }
                    if (binding.kind === "module") {
                        // direct use if imported component
                        identifierNode = path.node.name;
                        identifierBinding = binding;
                    } else {
                        // may be hoc
                        // 1) const Styled = styled(A)``
                        // 2) const A = HOC(B);
                        // 3) const C = A.B.C; // member access shorthand
                        if (!binding.path.isVariableDeclarator()) {
                            return;
                        }
                        const init = binding.path.node.init;
                        if (t.isIdentifier(init) || t.isMemberExpression(init)) {
                            identifierNode = init;
                            const leftIdentifier = getMostLeftIdentifier(identifierNode);
                            if (leftIdentifier) {
                                const newBinding = binding.path.scope.getBinding(leftIdentifier.name);
                                if (newBinding && newBinding.kind === "module") {
                                    identifierBinding = newBinding;
                                }
                            }
                        } else if (t.isTaggedTemplateExpression(init) || t.isCallExpression(init)) {
                            if (t.isTaggedTemplateExpression(init) && !t.isCallExpression(init.tag)) {
                                return;
                            }
                            let callExp = t.isTaggedTemplateExpression(init) ? init.tag as t.CallExpression : init;
                            if (t.isCallExpression(callExp.callee)) {
                                // const A = (0, _someHOC)(_ImportedComponent)(" styles ") - often as result of styled components preprocessors
                                // note: need to first process inner call expression, otherwise it may not work - see "Does not import inside in taggle template" test
                                [identifierNode, identifierBinding] = processHocLikeCallExpression(callExp.callee, binding.path.scope);
                            }
                            // otherwise process normally
                            if (!identifierNode) {
                                [identifierNode, identifierBinding] = processHocLikeCallExpression(callExp, binding.path.scope);
                            }
                        }
                    }
                }
                if (!identifierNode || !identifierBinding || identifierBinding.kind !== "module") {
                    return;
                }
                const identifierFullName = getFullNameOfIdentifier(identifierNode);
                if (this.mockedIdentifiers.includes(identifierFullName)) {
                    return;
                }
                if (!this.mockExpression) {
                    this.mockExpression = t.exportNamedDeclaration(t.variableDeclaration("const", [t.variableDeclarator(t.identifier("Mocks"), t.arrayExpression([]))]), []);
                    if (identifierBinding.scope.path.isProgram()) {
                        identifierBinding.scope.path.node.body.push(this.mockExpression);
                    }
                }
                const exportDecl = (this.mockExpression.declaration as b.types.VariableDeclaration).declarations[0].init as b.types.ArrayExpression;
                exportDecl.elements.push(t.objectExpression([
                    t.objectProperty(t.identifier("identifier"), t.stringLiteral(identifierFullName)),
                    t.objectProperty(t.identifier("path"), t.stringLiteral((identifierBinding.path.parent as t.ImportDeclaration).source.value)),
                    t.objectProperty(t.identifier("type"), t.stringLiteral(
                        identifierBinding.path.isImportDefaultSpecifier()
                            ? "default"
                            : identifierBinding.path.isImportNamespaceSpecifier()
                                ? "namespace"
                                : "name",
                    ))
                ]))
                this.mockedIdentifiers.push(identifierFullName);
            },
        }
    }
}