const crypto = require('crypto');
const util = require('util');

const LEVELS = { debug: 10, trace: 15, info: 20, warn: 30, error: 50 };

/* istanbul ignore next */
function CloudwatchLogger(opts) {
  this.level = opts && opts.level ? LEVELS[opts.level] || 0 : 0;
  this.stream = opts && opts.stream ? opts.stream : process.stdout;
}

/* istanbul ignore next */
CloudwatchLogger.prototype.debug = function (...args) {
  if (LEVELS.debug >= this.level) this._send('debug', args);
};
/* istanbul ignore next */
CloudwatchLogger.prototype.info = function (...args) {
  if (LEVELS.info >= this.level) this._send('info', args);
};
/* istanbul ignore next */
CloudwatchLogger.prototype.warn = function (...args) {
  if (LEVELS.warn >= this.level) this._send('warn', args);
};
/* istanbul ignore next */
CloudwatchLogger.prototype.error = function (...args) {
  if (LEVELS.error >= this.level) this._send('error', args);
};

CloudwatchLogger.prototype._send = function (type, args) {
  const output = { type };

  if (args.length === 1 && hasDepth(args[0])) {
    if (args[0] instanceof Error) output.error = module.exports.formatErr(args[0]);
    else output.data = JSON.parse(JSON.stringify(args[0]));
  } else if (args.length === 2 && typeof args[0] === 'string' && hasDepth(args[1])) {
    output.message = args[0];
    if (args[1] instanceof Error) output.error = module.exports.formatErr(args[1]);
    else output.data = JSON.parse(JSON.stringify(args[1]));
  } else {
    output.message = util.format(...args);
  }

  this._write(output);
};

/* istanbul ignore next */
CloudwatchLogger.prototype._write = function (output) {
  output = Object.assign({ timestamp: (new Date()).toISOString() }, output);
  this.stream.write(`${JSON.stringify(output)}\n`);
};

/* istanbul ignore next */
if ((process.env.NODE_ENV || 'development') === 'development') {
  CloudwatchLogger.prototype._write = function (output) {
    output = Object.assign({ timestamp: (new Date()).toString() }, output);
    this.stream.write(`\n${util.inspect(output, { depth: 5 })}\n`);
  };
}

module.exports.createLogger = function (opts) {
  return new CloudwatchLogger(opts || {});
};

module.exports.createMiddleware = function (opts) {
  opts = opts || {};

  // Ensure a valid loggers exist
  opts.logger = opts.logger instanceof CloudwatchLogger ? opts.logger : new CloudwatchLogger({
    stream: opts.stream,
  });

  // Set some defaults for the logged items
  opts.defaults = Object.assign({ type: 'req' }, typeof opts.defaults === 'object' ? opts.defaults : {});

  /* istanbul ignore if */
  if (typeof opts.header === 'string' && typeof opts.headerId !== 'function') {
    opts.headerId = () => crypto.randomBytes(12).toString('hex');
  }

  opts.req = typeof opts.req === 'function' ? opts.req : req => ({
    method: req.method,
    url: req.originalUrl || req.url,
    headers: req.headers,
    path: req.path,
    query: JSON.parse(JSON.stringify(req.query || {})),
    body: JSON.parse(JSON.stringify(req.body || {})),
  });

  opts.res = typeof opts.res === 'function' ? opts.res : res => ({
    statusCode: res.statusCode,
    headers: res._headers || {},
  });

  opts.format = typeof opts.format === 'function' ? opts.format : null;

  return function (req, res, next) {
    const record = {};
    if (typeof opts.header === 'string') {
      record.id = req.headers[opts.header.toLowerCase()] = opts.headerId();
      res.setHeader(opts.header, record.id);
    }

    // Create a request object
    record.req = opts.req(req);

    // When the request has finished
    res.on('finish', function () {
      // Create a response object
      record.res = opts.res(res);
      // Optionally format
      if (opts.format) opts.format(record, req, res);
      // And write the record or response out
      opts.logger._write(Object.assign({}, opts.defaults, record));
    });

    next();
  };
};

module.exports.formatErr = function (err, context) {
  return Object.assign({
    code: err.code || null,
    name: err.name || 'Error',
    message: err.message || `${err}`,
  }, context || {}, {
    stack: (err.stack || `${err}`).split('\n').map(s => s.trim()),
  });
};

function hasDepth(value) {
  return value && (value instanceof Error || typeof value === 'object' || Array.isArray(value));
}
