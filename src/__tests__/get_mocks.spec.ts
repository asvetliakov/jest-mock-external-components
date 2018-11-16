import { getMocks } from "../get_mocks";

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

    expect(getMocks(source, "flow")).toMatchSnapshot();
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
    expect(getMocks(source, "flow")).toMatchSnapshot();
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
    expect(getMocks(source, "flow")).toMatchSnapshot();
});

it("Does not import inside in tagged template", () => {
    const source = `
        import A from "a";
        import styled from "styled";
        import theme from "../theme";
        import { someFunc, someVal } from "./some";

        const StyledA = styled(A)\`
            color: \${theme.color.black};
        \`;

        const StyledB = styled("div") \`
            height: \${theme.elements.someHeight};
            width: \${theme.elements.someWidth};
        \`;

        const StyledC = styled("div") \`\${theme.someFunc()}\`;
        const StyledD = styled("div") \`\${someFunc()}\`;
        const StyledE = styled("div") \`\${() => someFunc()}\`;
        const StyledF = styled("div") \`\${someVal}\`;


        <StyledA />;
        <StyledB />;
        <StyledC />;
        <StyledD />;
        <StyledE />;
        <StyledF />;
        `;
    expect(getMocks(source, "flow")).toMatchSnapshot();
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
    expect(getMocks(source, "flow")).toMatchSnapshot();
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
    expect(getMocks(source, "flow")).toMatchSnapshot();
});

it("Works for nested member expressions inside HOC", () => {
    const source = `
        import A from "a";
        import styled from "styled";

        const Styled = styled(A.B.C);

        <Styled />;
        `;
    expect(getMocks(source, "flow")).toMatchSnapshot();
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
    expect(getMocks(source, "flow")).toMatchSnapshot();
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
    expect(getMocks(source, "typescript")).toMatchSnapshot();
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
    expect(getMocks(source, "flow")).toMatchSnapshot();
})

it("Real source 2", () => {

    const source = `
        import Scrollbar, { ScrollbarProps } from "react-smooth-scrollbar";
        import { AreaWrapperContainer, Message, MessagesContentContainer, PresenceMessage } from "../Elements";

        const StyledScrollbar = MessagesContentContainer.withComponent(Scrollbar) as any as StyledComponent<ScrollbarProps & { innerRef: (r: Scrollbar | null) => void }>;

        <StyledScrollbar />;
        `;
    expect(getMocks(source, "typescript")).toMatchSnapshot();
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
    expect(getMocks(source, "flow")).toMatchSnapshot();
});

it("Works for alwaysMockIdentifiers without JSX opening element", () => {
    const source = `
        import A from "a";
        import { B } from "../b";
        import C from "c";
        import D from "d";
        import styled from "styled";

        const StyledA = styled(A)\`\`;
        const StyledB = styled(A.B);
        const StyledC = styled(A.C, {});
        const StyledD = styled(A.D, {})\`font-size: 8em;\`;

        const B1 = A.withComponent(C.C1);
        const B2 = styled(D) \`\`;

        const B3 = nonStyled(C.C2);
        `;
    expect(getMocks(source, "flow")).toMatchSnapshot();
});
