'use strict';

const miniprofiler = require('@daniloisr/miniprofiler');
const http = require('http');
const ip = require('docker-ip');

const pg = require('pg');
const connString = `postgres://docker:docker@${ip()}:5050/docker`;
const client = new pg.Client({ connectionString: connString });
client.connect();

client.query('CREATE TABLE IF NOT EXISTS logs (name text, date date)');

const app = miniprofiler.express({
  enable: (req, res) => {
    return !req.url.startsWith('/unprofiled');
  }
});

const server = http.createServer((request, response) => {
  app(request, response, () => {
    miniprofiler.express.for(require('../index.js')(pg))(request, response, () => {

      if (request.url == '/pg-select') {
        client
          .query('SELECT $1::int AS number', [ 3 ])
          .then(() => response.end(''));
      }

      if (request.url == '/pg-select-promise') {
        client.query('SELECT $1::int AS number', [ 3 ], _result => response.end(''));
      }

      if (request.url == '/insert') {
        client
          .query('INSERT INTO logs (name, date) VALUES ($1, $2)', [ 'MiniProfiler', new Date() ])
          .then(() => response.end(''));
      }

      if (request.url == '/unprofiled') {
        client
          .query('SELECT $1::int AS number', ['123456'])
          .then(result => response.end(result.rows[0].number.toString()));
      }

    });
  });
});

module.exports = server;
