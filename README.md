# AWS Cloudwatch Logger

Send your application logs from your Docker containers directly to [AWS Cloudwatch](https://aws.amazon.com/cloudwatch/).
This is particularly ideal if you're running containers on [AWS EC2 Container Service](https://aws.amazon.com/ecs/),
although this has also been used to send logs from containers running on self-hosted hardware.

## Usage

```sh
$ npm install --save @car-throttle/aws-cloudwatch-logger
```

```js
const CloudwatchLogger = require('@car-throttle/aws-cloudwatch-logger');

const logger = CloudwatchLogger.createLogger();

logger.debug('This is a lovely debug message!');
// { timestamp: 'Wed Aug 23 2017 21:37:51 GMT+0100 (BST)',
//   type: 'debug',
//   message: 'This is a lovely debug message!' }

logger.info('Some information for you', { this: 'that' });
// { timestamp: 'Wed Aug 23 2017 21:37:51 GMT+0100 (BST)',
//   type: 'info',
//   message: 'Some information for you',
//   data: { this: 'that' } }

logger.warn('Important warning for you');
// { timestamp: 'Wed Aug 23 2017 21:37:51 GMT+0100 (BST)',
//   type: 'warn',
//   message: 'Important warning for you' }

logger.error(new Error('Oh man, this errored'));
// { timestamp: 'Wed Aug 23 2017 21:37:51 GMT+0100 (BST)',
//   type: 'error',
//   error:
//    { code: null,
//      name: 'Error',
//      message: 'Oh man, this errored',
//      stack:
//       [ 'Error: Oh man, this errored',
//         'at Object.<anonymous> (/workspace/example.js:17:14)',
//         'at Module._compile (module.js:571:32)',
//         '...', // Omitted
//         'at bootstrap_node.js:538:3' ] } }
```

In development, these will be lovely `util.inspect`'d objects, but in production the format will be minified to:

```
{"timestamp":"2017-08-23T21:37:51.574Z","type":"debug","message":"This is a lovely debug message!"}
{"timestamp":"2017-08-23T21:37:51.574Z","type":"info","message":"Some information for you","data":{"this":"that"}}
{"timestamp":"2017-08-23T21:37:51.574Z","type":"warn","message":"Important warning for you"}
{"timestamp":"2017-08-23T21:37:51.574Z","type":"error","error":{"code":null,"name":"Error","message":"Oh man, this errored","stack":["Error: Oh man, this errored","at Object.<anonymous> (/Users/james/Sites/Car-Throttle/aws-cloudwatch-logger/example.js:17:14)","at Module._compile (module.js:569:30)","...","at bootstrap_node.js:575:3"]}}
```

### Middleware

```js
const CloudwatchLogger = require('@car-throttle/aws-cloudwatch-logger');
const crypto = require('crypto');
const express = require('express');

const app = express();
const logger = CloudwatchLogger.createLogger();

app.use(CloudwatchLogger.createMiddleware());

app.get('/', (req, res) => res.json('Hello world!'));
// { timestamp: 'Wed Aug 23 2017 21:37:51 GMT+0100 (BST)',
//   type: 'req',
//   id: 'f283e4b5b608ee7a42d9c239',
//   req:
//    { method: 'GET',
//      url: '/?id=12&fields[]=id&fields[]=title&fields[]=content',
//      headers:
//       { accept: 'application/json, text/plain, */*',
//         connection: 'close',
//         host: '127.0.0.1:34685',
//         'user-agent': 'axios/0.16.2' },
//      path: '/',
//      query: { id: '12', fields: [ 'id', 'title', 'content' ] },
//      body: {} },
//   res:
//    { statusCode: 200,
//      headers:
//       { 'content-length': '14',
//         'content-type': 'application/json; charset=utf-8',
//         etag: 'W/"e-nkbG/vEV8ab/vH4HRSEWq+7z/MU"',
//         'x-powered-by': 'Express' } } }

app.post('/', (req, res) => res.status(201).json({
  entry_id: crypto.randomBytes(12).toString('hex'),
  success: true,
}));
// { timestamp: 'Wed Aug 23 2017 21:37:51 GMT+0100 (BST)',
//   type: 'req',
//   id: '5723372b27db8ad491e221da',
//   req:
//    { method: 'POST',
//      url: '/',
//      headers:
//       { accept: 'application/json, text/plain, */*',
//         connection: 'close',
//         'content-length': '25',
//         'content-type': 'application/json;charset=utf-8',
//         host: '127.0.0.1:34685',
//         'user-agent': 'axios/0.16.2' },
//      path: '/',
//      query: {},
//      body: [ 'example', 'post', 'data' ] },
//   res:
//    { statusCode: 201,
//      headers:
//       { 'content-length': '54',
//         'content-type': 'application/json; charset=utf-8',
//         etag: 'W/"36-2DtRf3MicJ/LCYV2dgBWg9MtJms"',
//         'x-powered-by': 'Express' } } }
```

And of course in production they will be minified.

## API

```js
const CloudwatchLogger = require('@car-throttle/aws-cloudwatch-logger');
const uuid = require('uuid');

// Creates a logger with debug(), info(), warn() & error() methods
const logger = CloudwatchLogger.createLogger({
  level: 'info', // Optionally set a base level, useful to ignore DEBUG messages in production
  stream: writeStream, // Optionally set a stream to write to instead of process.stdout
});

// Create a middleware function to log requests as responses are sent
const middleware = CloudwatchLogger.createMiddleware({
  logger, // Optionally include the CloudwatchLogger you previously instantiated
  // stream: writeStream, // If you do not include a CloudwatchLogger then one will be created for you with this option

  header: 'X-Request-ID', // Optionally attach an ID with the request
  headerId: () => uuid.v4(), // And a function to generate a header, otherwise crypto.randomBytes will be used

  // Overwrite the function used to create the logged request object
  // Be wary of using this function & where you place the createMiddleware function
  // E.g. placing this middleware before your authentication middleware means that req.user won't exist yet
  req(req) {
    return {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      path: req.path,
      query: JSON.parse(JSON.stringify(req.query || {})),
      body: JSON.parse(JSON.stringify(req.body || {})),
    };
  },
  // Overwrite the function used to create the logged response object
  res(res) {
    return {
      statusCode: res.statusCode,
      headers: res._headers || {},
    };
  },
  // Given that you may have other middleware functions that'll run after this, you can optionally append additional
  // items to the logged data right before it's sent to Cloudwatch.
  format(record, req, res) {
    if (req.user && req.user.id) record.req.user = { id: req.user.id };
  },
});

// Formats an error into an object, perfect for dropping into JSON.stringify
CloudwatchLogger.formatErr(new Error('This is not the error you are looking for, move along!'));
// { code: 'ROUTE_NOT_FOUND',
//   name: 'NotFoundError',
//   message: 'Route not found: /foobar',
//   stack:
//    [ 'NotFoundError: Route not found: /foobar',
//      'at app.use (/workspace/example.js:39:15)',
//      '...', // Omitted
//      'at /workspace/node_modules/express/lib/router/index.js:284:7' ] }
```

## Interesting use cases

### Attaching the error to the request log

Attaching the error object to `res.error` and then reattaching it in the `format` function right before the record is
sent to CloudWatch.

```js
const CloudwatchLogger = require('@car-throttle/aws-cloudwatch-logger');
const express = require('express');

const app = express();

app.use(CloudwatchLogger.createMiddleware({
  format(record, req, res) {
    if (res.error) record.res.error = res.error;
  },
}));

app.use((req, res, next) => {
  const err = new Error(`Route not found: ${req.url}`);
  err.code = 'ROUTE_NOT_FOUND';
  err.name = 'NotFoundError';
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  const output = {
    code: err.code || null,
    name: err.name || 'Error',
    message: err.message || `${err}`,
    status: err.status || 500,
  };

  res.error = CloudwatchLogger.formatErr(err);

  res.status(output.status).json(output);
});

// { timestamp: 'Wed Aug 23 2017 21:37:51 GMT+0100 (BST)',
//   type: 'req',
//   req:
//    { method: 'GET',
//      url: '/foobar',
//      headers:
//       { accept: 'application/json, text/plain, */*',
//         connection: 'close',
//         host: '127.0.0.1:34685',
//         'user-agent': 'axios/0.16.2' },
//      path: '/foobar',
//      query: '{}',
//      body: '{}' },
//   res:
//    { statusCode: 404,
//      headers:
//       { 'content-length': '99',
//         'content-type': 'application/json; charset=utf-8',
//         etag: 'W/"63-H7EMZzHMCMoTxCA4i0/u4Xhw7S0"',
//         'x-powered-by': 'Express' },
//      error:
//       { code: 'ROUTE_NOT_FOUND',
//         name: 'NotFoundError',
//         message: 'Route not found: /foobar',
//         stack:
//          [ 'NotFoundError: Route not found: /foobar',
//            'at app.use (/workspace/example.js:39:15)',
//            '...', // Omitted
//            'at /workspace/node_modules/express/lib/router/index.js:284:7' ] } } }
```

## Configuring ECS

- Enter the `awslogs-group` and `awslogs-region` when you change the container definition log configuration to
  `awslogs`.
- Create an ECS-task-definition IAM role and attach a policy to allow that role to add Cloudwatch logs.
- Don't forget to [configure](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html) your ECS
  instances!
