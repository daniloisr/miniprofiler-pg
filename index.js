'use strict';

let pgQuery;

module.exports = function(pg) {
  pgQuery = pgQuery || pg.Client.prototype.query;

  return {
    name: 'pg',
    handler: function(asyncContext, next) {
      pg.Client.prototype.query = !asyncContext.get() || !asyncContext.get().enabled ? pgQuery : function(config, values, callback) {
        if (callback) {
          asyncContext.get().timeQuery('sql', config.toString(), pgQuery.bind(this), config, values, callback);
          return;
        }

        const timing = asyncContext.get().startTimeQuery('sql', config.toString());
        const query = pgQuery.call(this, config, values, callback);

        return query.then(result => {
          asyncContext.get().stopTimeQuery(timing);
          return result;
        });
      };

      next();
    }
  };
};
