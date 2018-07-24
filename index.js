'use strict';

const asyncHooks = require('async_hooks');

let pgQuery;
const reqAsyncCxt = new Map();

asyncHooks.createHook({
  init(id, type, triggerId) {
    if (type === 'PROMISE' && reqAsyncCxt.has(triggerId))
      reqAsyncCxt.set(id, reqAsyncCxt.get(triggerId));
  },
  destroy(id) {
    reqAsyncCxt.delete(id);
  },
}).enable();

function getReq() {
  return reqAsyncCxt.get(asyncHooks.executionAsyncId());
}

module.exports = function(pg) {
  pgQuery = pgQuery || pg.Client.prototype.query;

  return {
    name: 'pg',
    handler: function(req, _res, next) {
      reqAsyncCxt.set(asyncHooks.executionAsyncId(), req);
      if (!req.miniprofiler || !req.miniprofiler.enabled || pg.Client.prototype.query !== pgQuery) return next();

      pg.Client.prototype.query = function(config, values, callback) {
        if (callback) {
          getReq().miniprofiler.timeQuery('sql', config.toString(), pgQuery.bind(this), config, values, callback);
        } else {
          const timing = getReq().miniprofiler.startTimeQuery('sql', config.toString());
          return pgQuery
            .call(this, config, values, callback)
            .then((res) => {
              getReq().miniprofiler.stopTimeQuery(timing);
              return res;
            });
        }
      };

      next();
    }
  };
};
