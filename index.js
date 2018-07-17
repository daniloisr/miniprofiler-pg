'use strict';

let pgQuery;

module.exports = function(pg) {
  pgQuery = pgQuery || pg.Client.prototype.query;

  return {
    name: 'pg',
    handler: function(req, res, next) {

      pg.Client.prototype.query = !req.miniprofiler || !req.miniprofiler.enabled ? pgQuery : function(config, values, callback) {
        if (callback) {
          req.miniprofiler.timeQuery('sql', config.toString(), pgQuery.bind(this), config, values, callback);
        } else {
          const timing = req.miniprofiler.startTimeQuery('sql', config.toString());
          const query = pgQuery.call(this, config, values, callback);
          query.then(() => req.miniprofiler.stopTimeQuery(timing));
          return query;
        }
      };

      next();
    }
  };
};
