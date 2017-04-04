'use strict';

const Shimmer = require('shimmer');
const Url = require('url');

const internals = {};

internals.createWrapper = function (TraceApi) {

  const wrapConnection = function (connection) {

    const traceConnection = function () {

      const server = connection.apply(this, arguments);

      server.ext('onRequest', function (request, reply) {

        const req = request.raw.req;
        const res = request.raw.res;

        const options = {
          name: Url.parse(req.url).pathname,
          url: req.url,
          traceContext: req.headers[TraceApi.constants.TRACE_CONTEXT_HEADER_NAME],
          skipFrames: 4
        };

        TraceApi.runInRootSpan(options, function rootTrace(root) {

          if (!root) {
            return reply.continue();
          }

          if (request.headers['user-agent'] && request.headers['user-agent'].startsWith('GoogleHC')) {
            return reply.continue();
          }

          TraceApi.wrapEmitter(req);
          TraceApi.wrapEmitter(res);

          res.setHeader(TraceApi.constants.TRACE_CONTEXT_HEADER_NAME, root.getTraceContext());

          const url = `${request.connection.info.uri}${req.url}`;
          const remoteIp = request.headers['x-forwarded-for'] ? request.headers['x-forwarded-for'].split(',').shift().trim() : req.connection.remoteAddress;

          root.addLabel(TraceApi.labels.HTTP_METHOD_LABEL_KEY, req.method);
          root.addLabel(TraceApi.labels.HTTP_URL_LABEL_KEY, url);
          root.addLabel(TraceApi.labels.HTTP_SOURCE_IP, remoteIp);
          root.addLabel('hapi/request/id', request.id);
          root.addLabel('hapi/request/userAgent', request.headers['user-agent']);

          if (request.method === 'post' || request.method === 'put') {
            root.addLabel('hapi/request/size', request.headers['content-length']);
          }

          Shimmer.wrap(res, 'end', function (end) {

            return function wrappedEnd() {

              const returned = end.apply(this, arguments);

              if (request.route) {
                root.addLabel('hapi/request/path', request.route.path);
              }

              root.addLabel(TraceApi.labels.HTTP_RESPONSE_SIZE_LABEL_KEY, request.response.headers['content-length']);
              root.addLabel(TraceApi.labels.HTTP_RESPONSE_CODE_LABEL_KEY, request.response.statusCode);

              root.endSpan();

              return returned;
            };
          });

          return reply.continue();
        });
      });

      return server;
    };

    return traceConnection;
  };

  return wrapConnection;
};


module.exports = [{
  versions: '16.x',
  patch: function (Hapi, TraceApi) {

    Shimmer.wrap(Hapi.Server.prototype, 'connection', internals.createWrapper(TraceApi));
  },
  unpatch: function (Hapi) {

    Shimmer.unwrap(Hapi.Server.prototype, 'connection');
  }
}];
