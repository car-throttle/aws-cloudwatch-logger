const _ = require('lodash');
const axios = require('axios');
const bodyParser = require('body-parser');
const CloudwatchLogger = require('./logger');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const util = require('util');

const app = express();
const logger = CloudwatchLogger.createLogger();
const server = http.createServer(app);

logger.debug('This is a lovely debug message!');
logger.info('Some information for you', { this: 'that' });
logger.warn('Important warning for you');
logger.error(new Error('Oh man, this errored'));

const sortObj = o => _(o).toPairs().sortBy(0).fromPairs().value();

app.use(bodyParser.json({ limit: '1mb' }));
app.use(CloudwatchLogger.createMiddleware({
  logger,
  format(record, req, res) {
    record.req.headers = sortObj(record.req.headers);
    record.res.headers = sortObj(record.res.headers);

    if (res.error) record.res.error = res.error;
  },
}));

app.get('/', (req, res) => res.json('Hello world!'));
app.post('/', (req, res) => res.status(201).json({
  entry_id: crypto.randomBytes(12).toString('hex'),
  success: true,
}));

app.use((req, res, next) => {
  const err = new Error(`Route not found: ${req.url}`);
  err.code = 'ROUTE_NOT_FOUND';
  err.name = 'NotFoundError';
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const output = {
    code: err.code || null,
    name: err.name || 'Error',
    message: err.message || `${err}`,
    status: err.status || 500,
  };

  res.error = CloudwatchLogger.formatErr(err);

  res.status(output.status).json(output);
});

server.listen(0, '127.0.0.1', () => {
  const { address, port } = server.address();
  const baseURL = `http://${address}:${port}`;
  logger.info('Example server started at', baseURL);

  const requests = [
    { method: 'GET', url: '/', params: { id: 12, fields: [ 'id', 'title', 'content' ] } },
    { method: 'GET', url: '/foobar' },
    { method: 'POST', url: '/', data: [ 'example', 'post', 'data' ] },
  ];
  const examples = async () => {
    const request = axios.create({ baseURL });
    for (var i in requests) {
      try { await request.request(requests[i]); }
      catch (err) {}
    }
  };
  examples().catch(err => logger.error(err)).then(() => server.close());
});
