'use strict';

const asyncHooks = require('async_hooks');

function installHook(ctx) {
  const init = (id, type, triggerId) => {
    if (type === 'PROMISE' && ctx.map.has(triggerId))
      ctx.map.set(id, ctx.map.get(triggerId));
  };
  const destroy = (id) => ctx.map.delete(id);

  asyncHooks.createHook({ init, destroy }).enable();
}

class AsyncContext {
  constructor() {
    this.map = new Map();
    installHook(this);
  }

  get miniprofiler() {
    const eId = asyncHooks.executionAsyncId();
    if (this.map.has(eId))
      return this.map.get(eId).miniprofiler;
  }

  set(req) {
    this.map.set(asyncHooks.executionAsyncId(), req);
  }
}

const asyncCtx = new AsyncContext();
let pgQuery;

module.exports = function(pg) {
  return {
    name: 'pg',
    handler: function(req, _res, next) {
      asyncCtx.set(req);

      // Install this provider only once
      if (pgQuery) return next();

      pgQuery = pgQuery || pg.Client.prototype.query;
      pg.Client.prototype.query = function(config, values, callback) {
        if (!asyncCtx.miniprofiler || !asyncCtx.miniprofiler.enabled || pg.Client.prototype.query !== pgQuery)
          return pgQuery.call(this, ...arguments);

        if (callback) {
          asyncCtx.miniprofiler.timeQuery('sql', config.toString(), pgQuery.bind(this), config, values, callback);
        } else {
          const timing = asyncCtx.miniprofiler.startTimeQuery('sql', config.toString());
          return pgQuery
            .call(this, ...arguments)
            .then((res) => {
              asyncCtx.miniprofiler.stopTimeQuery(timing);
              return res;
            });
        }
      };

      next();
    }
  };
};
