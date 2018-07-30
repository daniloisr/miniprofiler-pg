'use strict';

const miniprofiler = require('miniprofiler');
const http = require('http');
const ip = require('docker-ip');

const pg = require('pg');
const connString = `postgres://docker:docker@${ip()}:5050/docker`;
const client = new pg.Client({ connectionString: connString });
client.connect();
client.query('create table if not exists logs(name varchar(256), date date);');

const server = http.createServer((request, response) => {
  response.locals = response.locals || {};

  const app = miniprofiler.express({
    enable: (req, _res) => !req.url.startsWith('/unprofiled'),
    providers: [require('../index.js')(pg)]
  });

  app(request, response, () => {
    if (request.url == '/pg-select') {
      client.query('SELECT $1::int AS number', [3])
        .then(_ => response.end(''));
    }

    if (request.url == '/pg-select-event') {
      client.query('SELECT $1::int AS number', [3])
        .then(_ => response.end(''));
    }

    if (request.url == '/insert') {
      client.query('INSERT INTO logs (name, date) VALUES ($1, $2)', ['MiniProfiler', new Date()])
        .then(_ => response.end(''));
    }

    if (request.url == '/unprofiled') {
      client.query('SELECT $1::int AS number', ['123456'])
        .then(res => response.end(res.rows[0].number.toString()));
    }
  });
});

module.exports = server;
