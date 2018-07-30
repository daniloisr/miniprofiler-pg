'use strict';
let pgQuery;

module.exports = function(pg) {
  pgQuery = pgQuery || pg.Client.prototype.query;

  return {
    name: 'pg',
    install: function(asyncCtx) {
      pg.Client.prototype.query = function(config, values, callback) {
        const miniprofiler = asyncCtx.miniprofiler;
        if (!miniprofiler || !miniprofiler.enabled)
          return pgQuery.call(this, ...arguments);

        if (callback) {
          miniprofiler.timeQuery('sql', config.toString(), pgQuery.bind(this), config, values, callback);
        } else {
          const timing = miniprofiler.startTimeQuery('sql', config.toString());
          return pgQuery
            .call(this, ...arguments)
            .then((res) => {
              miniprofiler.stopTimeQuery(timing);
              return res;
            });
        }
      };
    }
  };
};
