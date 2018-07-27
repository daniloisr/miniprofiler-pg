'use strict';

const asyncHooks = require('async_hooks');

class AsyncContext {
  constructor() {
    this.map = new Map();
    asyncHooks.createHook({
      init: (id, type, triggerId) => {
        if (type === 'PROMISE' && this.map.has(triggerId))
          this.map.set(id, this.map.get(triggerId));
      },
      destroy: (id) => this.map.delete(id)
    }).enable();
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
        if (!asyncCtx.miniprofiler || !asyncCtx.miniprofiler.enabled)
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
