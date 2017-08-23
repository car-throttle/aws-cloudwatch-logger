const assert = require('assert');

describe('aws-cloudwatch-logger', function () {
  const CloudwatchLogger = require('./logger');
  function createLogger(opts) {
    const logger = CloudwatchLogger.createLogger(opts);
    logger._contents = [];
    logger._write = output => logger._contents.push(output);
    return logger;
  }

  describe('logger', function () {

    it('should write a debug message', function () {
      const logger = createLogger();
      logger.debug('This is the first message, and it\'s text-only');
      logger.debug('And this is the second message', { one: 1, two: 2 });
      logger.debug({ one: 1, two: 2, three: 3 });

      assert.deepEqual(logger._contents, [
        { type: 'debug', message: 'This is the first message, and it\'s text-only' },
        { type: 'debug', message: 'And this is the second message', data: { one: 1, two: 2 } },
        { type: 'debug', data: { one: 1, two: 2, three: 3 } },
      ]);
    });

    it('should write an info message', function () {
      const logger = createLogger();
      logger.info('This is the first message, and it\'s text-only');
      logger.info('And this is the second message', { one: 1, two: 2 });
      logger.info({ one: 1, two: 2, three: 3 });

      assert.deepEqual(logger._contents, [
        { type: 'info', message: 'This is the first message, and it\'s text-only' },
        { type: 'info', message: 'And this is the second message', data: { one: 1, two: 2 } },
        { type: 'info', data: { one: 1, two: 2, three: 3 } },
      ]);
    });

    it('should write a warning message', function () {
      const logger = createLogger({ level: 'warn' });
      logger.debug('This is the a secret debug message that should be ignored');
      logger.warn('This is the first message, and it\'s text-only');
      logger.warn('And this is the second message', { one: 1, two: 2 });
      logger.warn({ one: 1, two: 2, three: 3 });

      assert.deepEqual(logger._contents, [
        { type: 'warn', message: 'This is the first message, and it\'s text-only' },
        { type: 'warn', message: 'And this is the second message', data: { one: 1, two: 2 } },
        { type: 'warn', data: { one: 1, two: 2, three: 3 } },
      ]);
    });

    it('should write a error message', function () {
      const logger = createLogger();
      logger.error('This is the first message, and it\'s text-only');
      logger.error('And this is the second message', { one: 1, two: 2 });
      logger.error('But this is a third message', new Error('Something bad happened'));
      logger.error(new Error('Something else bad happened'));

      // For this test, cut off the rest of the error stack, it's not required here
      logger._contents[2].error.stack = logger._contents[2].error.stack.slice(0, 1);
      logger._contents[3].error.stack = logger._contents[3].error.stack.slice(0, 1);

      assert.deepEqual(logger._contents, [
        { type: 'error', message: 'This is the first message, and it\'s text-only' },
        { type: 'error', message: 'And this is the second message', data: { one: 1, two: 2 } },
        {
          type: 'error',
          message: 'But this is a third message',
          error: {
            code: null,
            name: 'Error',
            message: 'Something bad happened',
            stack: [ 'Error: Something bad happened' ],
          },
        },
        {
          type: 'error',
          error: {
            code: null,
            name: 'Error',
            message: 'Something else bad happened',
            stack: [ 'Error: Something else bad happened' ],
          },
        },
      ]);
    });

  });

  describe('middleware', function () {

    it('should create a middleware function successfully', function () {
      const middleware = CloudwatchLogger.createMiddleware();
      assert.equal(typeof middleware, 'function');
      assert.equal(middleware.length, 3);
    });

  });

  describe('formatErr', function () {

    it('should format an Error', function () {
      const err = new Error('Something bad happened');

      const out = CloudwatchLogger.formatErr(err);
      out.stack = out.stack.slice(0, 1);
      assert.deepEqual(out, {
        code: null,
        name: 'Error',
        message: 'Something bad happened',
        stack: [ 'Error: Something bad happened' ],
      });
    });

    it('should format a NotFoundError', function () {
      const err = new Error('Route not found: /foo/bar');
      err.code = 'ROUTE_NOT_FOUND';
      err.name = 'NotFoundError';

      const out = CloudwatchLogger.formatErr(err);
      out.stack = out.stack.slice(0, 1);
      assert.deepEqual(out, {
        code: 'ROUTE_NOT_FOUND',
        name: 'NotFoundError',
        message: 'Route not found: /foo/bar',
        stack: [ 'NotFoundError: Route not found: /foo/bar' ],
      });
    });

    it('should format an Error with some context', function () {
      const err = new Error('Invalid database query: "PICK 1 FROM 1MILLION" is not a valid query');
      err.code = 'INVALID_DATABASE_QUERY';
      err.name = 'CrazyDatabaseDriverError';

      const out = CloudwatchLogger.formatErr(err, {
        name: 'UnusualDatabaseError',
        message: 'Error returning data from the database',
      });
      out.stack = out.stack.slice(0, 1);
      assert.deepEqual(out, {
        code: 'INVALID_DATABASE_QUERY',
        name: 'UnusualDatabaseError',
        message: 'Error returning data from the database',
        stack: [ 'CrazyDatabaseDriverError: Invalid database query: "PICK 1 FROM 1MILLION" is not a valid query' ],
      });
    });

    it('should format an string as an error', function () {
      const out = CloudwatchLogger.formatErr('Something bad happened, but this ain\'t no regular Error');
      assert.deepEqual(out, {
        code: null,
        name: 'Error',
        message: 'Something bad happened, but this ain\'t no regular Error',
        stack: [ 'Something bad happened, but this ain\'t no regular Error' ],
      });
    });

  });

});
