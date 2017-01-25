'use strict';

const WError = require('verror').WError;

class Response {
  constructor(options) {
    options = options || {}; // eslint-disable-line no-param-reassign

    this.body = options.body || {};
    this.statusCode = options.statusCode || 200;
  }

  toJSON() {
    return {
      body: this.body,
      statusCode: this.statusCode
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
        body: payload
      });
    }

    if (awsResponse.FunctionError) {
      if (awsResponse.FunctionError === 'Unhandled'
        || Object.keys(payload).length !== 1
        || !payload.errorMessage) {
        return new Response({
          statusCode: 500,
          body: payload
        });
      }

      let errorDetails;
      try {
        errorDetails = JSON.parse(payload.errorMessage);
      } catch (err) {
        return new Response({
          statusCode: 500,
          body: payload.errorMessage
        });
      }

      return new Response({
        statusCode: errorDetails.statusCode || 500,
        body: errorDetails.body || errorDetails
      });
    }

    if (!payload.body) {
      return new Response({
        statusCode: 200,
        body: payload
      });
    }

    return new Response(payload);
  }
}

module.exports = Response;
