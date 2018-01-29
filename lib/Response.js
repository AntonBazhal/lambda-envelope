'use strict';

const WError = require('verror').WError;

const DEFAULT_ENCODING = 'identity';

class Response {
  constructor(options) {
    options = options || {}; // eslint-disable-line no-param-reassign

    this.statusCode = options.statusCode || 200;
    this.encoding = options.encoding || DEFAULT_ENCODING;
    this.body = Object.prototype.hasOwnProperty.call(options, 'body')
      ? options.body
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

  static fromAWSResponse(awsResponse) {
    let payload;
    try {
      payload = JSON.parse(awsResponse.Payload);
    } catch (err) {
      throw new WError('failed to parse response payload', err);
    }

    if (typeof payload !== 'object') {
      return new Response({
        statusCode: 200,
        encoding: DEFAULT_ENCODING,
        body: payload
      });
    }

    if (awsResponse.FunctionError) {
      if (awsResponse.FunctionError === 'Unhandled'
        || Object.keys(payload).length !== 1
        || !payload.errorMessage) {
        return new Response({
          statusCode: 500,
          encoding: DEFAULT_ENCODING,
          body: payload
        });
      }

      let errorDetails;
      try {
        errorDetails = JSON.parse(payload.errorMessage);
      } catch (err) {
        return new Response({
          statusCode: 500,
          encoding: DEFAULT_ENCODING,
          body: payload.errorMessage
        });
      }

      return new Response({
        statusCode: errorDetails.statusCode || 500,
        encoding: errorDetails.encoding || DEFAULT_ENCODING,
        body: errorDetails.body || errorDetails
      });
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'body')) {
      return new Response({
        statusCode: 200,
        encoding: DEFAULT_ENCODING,
        body: payload
      });
    }

    return new Response(payload);
  }
}

module.exports = Response;
