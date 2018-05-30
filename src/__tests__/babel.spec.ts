import plugin from "../babel";
import { transform } from "@babel/core";

describe("For component like source", () => {

    it("Works for JSX expressions", () => {
        const source = `
        import A from "a";
        import { B } from "../b";
        import * as C from "c/test";

        const Element = () => <div />;

        <A />;
        <A.A1 />;
        <B><div /></B>;
        <B.B1 />;
        <C.C1 />;
        <C.C1.C2 />;
        <C.C2.C3.C4 />;

        class K extends React.Component {
            render() {
                <Element />;
                return (<A><B.B1><C.C1 /></B.B1></A>);
            }
        }

        <K><A /></K>;
        `;

        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    });

    it("Works for HOC like components", () => {
        const source = `
        import A from "a";
        import styled from "styled";

        const StyledA = styled(A)\`\`;
        const StyledB = styled(A.B);
        const StyledC = styled(A.C, {});
        const StyledD = styled(A.D, {})\`font-size: 8em;\`;

        <A />;

        class K extends React.Component {
            render() {
                return <div><StyledA /><StyledB /><StyledC /><StyledD /></div>
            }
        }

        <K><StyledA /><StyledB /><StyledC /><StyledD /></K>
        `;

        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    });

    it("Does not append imported if not used in HOC as argument", () => {
        const source = `
        import A from "a";
        import styled from "styled";
        import C from "../c";

        const StyledA = styled(A)\`\`;
        const Comp = styled("div")\`\`;
        const StyledB = A;

        const K = C.A.B;


        <StyledA />;
        <Comp />;
        <StyledB />;
        <K />;
        `;

        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    });

    it("Does not import inside in tagged template", () => {
        const source = `
        import A from "a";
        import styled from "styled";
        import theme from "../theme";

        const StyledA = styled(A)\`
            color: \${theme.color.black};
        \`;


        <StyledA />;
        `;

        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    });

    it("Does not import inside in tagged template 2", () => {
        const source = `
        import { A, B } from "some-lib";
        import styled, { theme } from "styled";

        const StyledA = styled(A)\`
            color: \${theme.color.black};
        \`;

        const StyledB = styled(B)\`
            color: \${theme.color.white};
        \`;

        <StyledA />;
        <StyledB />;
        `;

        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();

    });

    it("Works when HOC component was used in HOC for other component", () => {
        const source = `
        import A from "a";
        import styled from "styled";

        const StyledA = styled(A)\`
            font-size: 1em;
        \`;
        const StyledB = styled(StyledA)\`
            width: 50px;
        \`;
        const StyledC = styled(StyledB)\`
            height: 60px;
        \`;

        const StyledD = HOC(StyledA);
        const StyledE = HOC({}, StyledB);
        const StyledF = HOC(StyledE, {});

        <StyledA />;
        <StyledB />;
        <StyledC />;
        <StyledD />;
        <StyledE />;
        <StyledF />;
        `;

        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    });

    it("Works for nested member expressions inside HOC", () => {
        const source = `
        import A from "a";
        import styled from "styled";

        const Styled = styled(A.B.C);

        <Styled />;
        `;
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    });

    it("Works for member expression without HOC", () => {
        const source = `
        import A from "a";
        import * as B from "b";

        const FakeA = A.B;
        const FakeB = B.C.D;

        <FakeA />;
        <FakeB />;
        `;
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    })

    it("Works with TS annotations", () => {
        const source = `
        import { A } from "a";
        import styled from "styled";

        const StyledA: SomeComponentClass = A;
        <StyledA />;

        const StyledB: SomeClass<Props> = styled(A);
        <StyledB />;

        const StyledC = styled<Props>(A)\`\`;
        <StyledC />;

        const StyledD = (styled as any)(A);
        <StyledD />;

        const StyledE = styled(A as SomeClass)\`\`;
        <StyledE />;

        const StyledF = styled(A) as any as SomeClass<Props>;
        <StyledF />;

        const StyledG = styled.withComponent(A);
        <StyledG />;

        const StyledH = styled.withComponent<Props>(A)\`\`;
        <StyledH />;

        const StyledK = styled.withComponent(A as SomeClass<Props>)\`\`;
        <StyledK />;
        `;
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/typescript", "@babel/react"], filename: "test.tsx" }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/typescript", "@babel/react"], filename: "test.tsx" }).code).toMatchSnapshot();
    });

    it("Real source 1", () => {
        const source = `
        import { ModalCloseIcon, ModalHeader } from "@ramble/ramble-ui";
        import React from "react";
        import styled, { theme } from "../../theme";

        const MapHeader = styled(ModalHeader) \`
            padding-bottom: 0.5rem;
            border-bottom: 0;

            /* since modal will be basic and dimmed we need contrast color of dimmmer */
            color: \${theme.getContrastTextColor(theme.dimmer.black).string()};
            justify-content: space-between;
        \`;

        const CloseIcon = styled(ModalCloseIcon) \`
            color: \${theme.getContrastTextColor(theme.dimmer.black).string()};
            padding: 0;
            margin: 0;
        \`;

        <MapHeader />;
        <CloseIcon />;
        `;
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    })

    it("Real source 2", () => {

        const source = `
        import Scrollbar, { ScrollbarProps } from "react-smooth-scrollbar";
        import { AreaWrapperContainer, Message, MessagesContentContainer, PresenceMessage } from "../Elements";

        const StyledScrollbar = MessagesContentContainer.withComponent(Scrollbar) as any as StyledComponent<ScrollbarProps & { innerRef: (r: Scrollbar | null) => void }>;

        <StyledScrollbar />;
        `;
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react", "@babel/typescript"], filename: "test.tsx" }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/typescript", "@babel/react"], filename: "test.tsx" }).code).toMatchSnapshot();
    });

    it("Real source 3", () => {
        const source = `
        "use strict";

        import React from "react";
        import styled from "../../../theme";
        import { HeaderDropdownMenu } from "../HeaderDropdownMenu";

        // Like processed by emotion/styled-components babel plugin
        const MenuItem =
        /*#__PURE__*/
        styled(HeaderDropdownMenu, {
        label: "MenuItem",
        target: "ev6xfg12"
        })("padding:11px 16px;width:100%;display:flex;flex-flow:column nowrap;justify-content:flex-start;align-items:stretch;& > .toggle{margin-left:1em;}");

        function TeamStatusItem(props) {
            return (
                <MenuItem />
            );
        }
        `;
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", "emotion", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
    });

    it("Bails if mockExternalIdentifier exist", () => {
        const source = `
        import A from "a";
        import { B } from "../b";
        import * as C from "c/test";

        const Element = () => <div />;

        mockExternalComponents(A);

        <A />;
        <B><div /></B>;
        <B.B1 />;
        <C.C1 />;
        `;

        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] }).code).toMatchSnapshot();
    });
});

describe("For test like source", () => {
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
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] , filename: "/test.jsx" }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "/test.jsx" }).code).toMatchSnapshot();
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
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] , filename: "/test.jsx" }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();
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
        expect(() => transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "test.jsx" })).toThrowErrorMatchingSnapshot();
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
        expect(transform(source, { babelrc: false, plugins: [plugin], presets: ["@babel/react"] , filename: "/test.jsx" }).code).toMatchSnapshot();
        expect(transform(source, { babelrc: false, plugins: ["@babel/transform-modules-commonjs", plugin], presets: ["@babel/react"], filename: "test.jsx" }).code).toMatchSnapshot();

    });
});