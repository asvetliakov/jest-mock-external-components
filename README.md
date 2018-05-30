## Easy automock your react components

Do you like write component tests? Do you like react-test-renderer more than shallow renderer? Do you feel sometimes that it would be great to combine both shallow renderer and react-test-renderer to prevent rendering inner components? Do you feel headcache when writing tests for something like [styled-components](https://www.styled-components.com/) ?

If answer for these all questions is "Yes" then you come to the right place.


Much often, you want to mock/don't render external components. Almost always these external components are being imported through import statement ```import A from "./a"```. And very often you want to full render the inner (helpers or styled) components:

```jsx
import Button from "./Button";
import AnotherComp from "./AnotherComp";

const SomeText = () => <h1>SomeText</h1>

const SomeLabel = styled.label`
    font-size: 0.8em;
`;

const MyButton = styled(Button)`
    font-size: 2em;
`

const Component = () =>
<div>
    <SomeText />
    <AnotherComp />
    <SomeLabel>Label</SomeLabel>
    <MyButton>Button</MyButton>
</div>

```

Here you probably want to fully render ```SomeText``` , ```SomeLabel``` and partially ```MyButton``` (render styles but don't render ```Button``` itself). ```AnotherComp``` should remain non-rendered (so it's internals won't affect the component test).

This is not achievable by standard react-test-renderer, it will give you snapshot similar to this:
```html
.SomeLabelCss {}

.MyButtonCss {}

// Shouldn't be here
.ButtonCss {}

// Shouldn't be here
.AnotherCompCss {}

<div>
    <h1>SomeText</h1>
    // Shouldn't be here
    <div className="AnotherCompCss">AnotherComp internals</div>
    <label className="SomeLabelCss">Label</label>
    // Shouldn't be here
    <button className="MyButtonCss ButtonCss">Button</button>
</div>
```

Shallow renderer also won't give you desired result:

```html
// No styles since it doesn't unwrap styled-component HOC

<div>
    // Didn't unwrap the internal component
    <SomeText />
    <AnotherComp />
    // Didn't unwrap the internal component
    <SomeLabel>Label</SomeLabel>
    // Didn't unwrap the internal component
    <MyButton>Button</MyButton>
</div>

```

Ideally, you want this snapshot:

```html
.SomeLabelCss {}

.MyButtonCss {}

<div>
    <h1>SomeText></h1>
    // External component shouldn't be rendered
    <AnotherComp />
    <label className="SomeLabelCss">Label</label>
    // Unwrap styled HOC but don't render further. Button already has dedicated test
    <Button className="MyButtonCss">Button</Button>
</div>

```

This is achievable by mocking components using ```jest.mock()``` but this is boring and repetetive task, especially when you have to mock many components.

Finally, now you can just use ```jest-mock-external-components```:

```js
import Component from "../mycomponent";
import { mockExternalComponents } from "jest-mock-external-components";
mockExteralComponents(Component);
// will mock <Button /> and <AnotherComp />

// Use react-test-renderer
const t = create(<Component />);
expect(t.toJSON()).toMatchSnapshot();
```

and it will you give the snapshot which you want with mocked external dependencies and fully-rendered internal components! and it's not shallow, so the lifecycle, refs etc will continue to work.

## Installation and setup

```yarn add jest-mock-external-components --dev```
or
```npm install jest-mock-external-components --save-dev```

Add to your ```.babelrc``` / ```.babelrc.js``` / ```babel.config.js```

```
    plugins: [
        "jest-mock-external-components/babel",
    ]
```

## Caveats
After mocking, at beginning of the test file the ```jest.resetModules()``` will be called. Make sure you won't set internal state somewhere before (for example in setupFiles/setupTestFrameworkFile)