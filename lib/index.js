'use strict';

const Agent = require('@google-cloud/trace-agent');
const Keyfob = require('keyfob');
const Path = require('path');

const internals = {};
internals.noop = () => {};

internals.mockSpan = {
  addLabel: internals.noop,
  endSpan: internals.noop
};

exports.get = Agent.get;
exports.start = () => {

  if (!process.env.GCLOUD_PROJECT) {
    return Agent.get();
  }

  return Agent.start({
    plugins: Keyfob.load({ path: '../plugins', fn: (path) => path })
  });
};


exports.trace = (name, fn) => {

  const agent = Agent.get();
  const span = agent.createChildSpan({ name, skipFrames: 1 }) || internals.mockSpan;
  return fn(span).then((res) => {

    span.endSpan();
    return res;
  }).catch((err) => {

    span.addLabel(agent.labels.ERROR_DETAILS_NAME, err.name);
    span.addLabel(agent.labels.ERROR_DETAILS_MESSAGE, err.message);
    span.endSpan();
    throw err;
  });
};
