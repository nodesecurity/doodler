'use strict';

const Shimmer = require('shimmer');

const internals = {};

internals.createWrapper = function (TraceApi) {

  const wrapQuery = function (query) {

    return function traceQuery() {

      const span = TraceApi.createChildSpan({ name: 'pg-query' });
      const pgQuery = query.apply(this, arguments);

      if (!span) {
        return pgQuery;
      }

      span.addLabel('query', pgQuery.text);
      if (pgQuery.values) {
        span.addLabel('values', pgQuery.values);
      }

      TraceApi.wrapEmitter(pgQuery);
      const done = pgQuery.callback;

      pgQuery.callback = TraceApi.wrap(function (err, res) {

        if (err) {
          span.addLabel('error', err);
        }

        if (res) {
          span.addLabel('row_count', res.rowCount);
          span.addLabel('oid', res.oid);
          span.addLabel('rows', res.rows);
          span.addLabel('fields', res.fields);
        }

        span.endSpan();
        if (done) {
          return done(err, res);
        }
      });

      return pgQuery;
    };
  };

  return wrapQuery;
};

module.exports = [{
  versions: '5.x',
  patch: function (Pg, TraceApi) {

    Shimmer.wrap(Pg.Client.prototype, 'query', internals.createWrapper(TraceApi));
  },
  unpatch: function (Pg) {

    Shimmer.unwrap(Pg.prototype, 'query');
  }
}];
