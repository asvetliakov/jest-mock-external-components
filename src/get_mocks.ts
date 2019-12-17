import { parse } from "@babel/parser";
import traverse, { TraverseOptions, Binding, Scope } from "@babel/traverse";
import * as t from "@babel/types";

export interface Mock {
    identifier: string;
    path: string;
    type: "namespace" | "name" | "default";
}

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

const processHocLikeCallExpression = (exp: t.CallExpression, scope: Scope): [t.Identifier | t.MemberExpression | undefined, Binding | undefined] => {
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
        if (!binding.path.isVariableDeclarator() || !(t.isTaggedTemplateExpression(binding.path.node.init!) || t.isCallExpression(binding.path.node.init!))) {
            return [undefined, undefined];
        }
        const init = binding.path.node.init;
        if (!init) {
            return [undefined, undefined];
        }
        if (t.isTaggedTemplateExpression(init) && !t.isCallExpression(init.tag)) {
            return [undefined, undefined];
        }
        let callExp = t.isCallExpression(init) ? init : (init as t.TaggedTemplateExpression).tag as t.CallExpression;
        // const A = (0, _someHOC)(_ImportedComponent)(" styles ") - often as result of styled components preprocessors
        if (t.isCallExpression(callExp.callee)) {
            callExp = callExp.callee;
        }
        return processHocLikeCallExpression(callExp, binding.path.scope);
    }
}

interface State {
    mocks: Mock[];
    alwaysMockIdentifiers: string[];
    mockedIdentifiers: string[];
}


const visitor: TraverseOptions = {
    CallExpression(path, state: State) {
        const callIdentifier = t.isIdentifier(path.node.callee)
            ? path.node.callee
            : t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.property)
                ? path.node.callee.property
                : undefined;
        if (!callIdentifier || !state.alwaysMockIdentifiers.includes(callIdentifier.name)) {
            return;
        }
        let identifierNode: t.Identifier | t.MemberExpression | undefined;
        let identifierBinding: Binding | undefined;
        if (t.isCallExpression(path.node.callee)) {
            [identifierNode, identifierBinding] = processHocLikeCallExpression(path.node.callee, path.scope);
        }
        if (!identifierNode) {
            [identifierNode, identifierBinding] = processHocLikeCallExpression(path.node, path.scope);
        }
        if (!identifierNode || !identifierBinding || identifierBinding.kind !== "module") {
            return;
        }
        const identifierFullName = getFullNameOfIdentifier(identifierNode);
        if (state.mockedIdentifiers.includes(identifierFullName)) {
            return;
        }
        // if (!state.mockExpression) {
        //     state.mockExpression = createEmptyMockExpression(identifierBinding.scope);
        // }
        // pushMockObjExpression(this.mockExpression, identifierFullName, identifierBinding);
        state.mocks.push({
            identifier: identifierFullName,
            path: (identifierBinding.path.parent as t.ImportDeclaration).source.value,
            type: identifierBinding.path.isImportDefaultSpecifier() ? "default" : identifierBinding.path.isImportNamespaceSpecifier() ? "namespace" : "name",
        });
        state.mockedIdentifiers.push(identifierFullName);
    },
    JSXOpeningElement(path, state: State) {
        let identifierNode: t.MemberExpression | t.Identifier | t.JSXMemberExpression | t.JSXIdentifier | undefined;
        let identifierBinding: Binding | undefined;
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
            if (!binding) {
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
                if (init && (t.isIdentifier(init) || t.isMemberExpression(init))) {
                    identifierNode = init;
                    const leftIdentifier = getMostLeftIdentifier(identifierNode);
                    if (leftIdentifier) {
                        const newBinding = binding.path.scope.getBinding(leftIdentifier.name);
                        if (newBinding && newBinding.kind === "module") {
                            identifierBinding = newBinding;
                        }
                    }
                } else if (init && (t.isTaggedTemplateExpression(init) || t.isCallExpression(init))) {
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
                    if (!identifierNode && !t.isCallExpression(callExp.callee)) {
                        [identifierNode, identifierBinding] = processHocLikeCallExpression(callExp, binding.path.scope);
                    }
                }
            }
        }
        if (!identifierNode || !identifierBinding || identifierBinding.kind !== "module") {
            return;
        }
        const identifierFullName = getFullNameOfIdentifier(identifierNode);
        if (state.mockedIdentifiers.includes(identifierFullName)) {
            return;
        }
        // if (!this.mockExpression) {
        //     this.mockExpression = createEmptyMockExpression(identifierBinding.scope);
        // }
        // pushMockObjExpression(this.mockExpression, identifierFullName, identifierBinding);
        // this.mockedIdentifiers.push(identifierFullName);
        state.mocks.push({
            identifier: identifierFullName,
            path: (identifierBinding.path.parent as t.ImportDeclaration).source.value,
            type: identifierBinding.path.isImportDefaultSpecifier() ? "default" : identifierBinding.path.isImportNamespaceSpecifier() ? "namespace" : "name",
        });
        state.mockedIdentifiers.push(identifierFullName);
    },
}

export function getMocks(code: string, type: "flow" | "typescript", alwaysMock: string[] = ["styled", "withComponent"]): Mock[] {
    try {
        const state: State = {
            mocks: [],
            mockedIdentifiers: [],
            alwaysMockIdentifiers: alwaysMock,
        };

        const ast = parse(code, {
            sourceType: "module",
            plugins: [
                "jsx",
                type,
                "asyncGenerators",
                "classProperties",
                "classPrivateProperties",
                "classPrivateMethods",
                ["decorators", { decoratorsBeforeExport: true }] as any,
                "doExpressions",
                "dynamicImport",
                "functionBind",
                "functionSent",
                "objectRestSpread",
                "bigInt",
                "exportDefaultFrom",
                "exportNamespaceFrom",
                "importMeta",
                "optionalCatchBinding",
                "optionalChaining",
                "nullishCoalescingOperator"
            ],
        });
        if (!ast) {
            return [];
        }
        traverse(ast, visitor, undefined, state);
        return state.mocks;
    } catch {
        return [];
    }
}