'use strict';

const DEFAULT_ENCODING = 'identity';

class Response {
  constructor({ body, encoding, statusCode } = {}) {

    this.statusCode = statusCode || 200;
    this.encoding = encoding || DEFAULT_ENCODING;
    this.body = typeof body !== 'undefined'
      ? body
      : {};
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      encoding: this.encoding,
      body: this.body
    };
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }
}

module.exports = Response;
