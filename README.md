## tracer

This module is a shim around @google-cloud/trace-agent to allow us to use it even when we're not running in the google cloud environment and not have to worry about wrapping it in a bunch of if statements. It also provides a helper method to make tracing functions easier, and bundles custom plugins for the trace agent.

### usage

```js
const Tracer = require('@andyet/tracer');
Tracer.start();

Tracer.trace('spanName', (span) => {

  span.addLabel('labelName', 'labelValue');
  return somethingAsync().then((res) => {

    span.addLabel('moreLabels', 'ifYouWant');
    return moreStuff();
  });
});
```

The `trace` method will take care of creating the child span (or providing a mock if the child span cannot be created) as well as closing the span when your promise resolves. In addition, if your promise rejects the helper will automatically populate the relevant error detail name and message labels before ending the span.

### custom plugins

Any modules in the `plugins` directory of this repo will be passed as plugins to the trace-agent on startup, make sure the filename matches the name of the module your plugin will hook into. See the [trace-agent docs](https://github.com/GoogleCloudPlatform/cloud-trace-nodejs/blob/master/doc/plugin-guide.md) for more information on writing plugins.
