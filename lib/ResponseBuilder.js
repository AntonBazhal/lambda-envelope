'use strict';

const AWS = require('aws-sdk');
const got = require('got');
const uuid = require('uuid');
const { WError } = require('verror');
const zlib = require('zlib');

const Response = require('./Response');

const DEFAULTS = {
  THRESHOLD: 6291456, // 6 MB
  URL_TTL: 30
};

const ENCODINGS = {
  GZIP: 'gzip',
  S3: 's3'
};

class ResponseBuilder {
  // eslint-disable-next-line object-curly-newline
  constructor({ bucket, s3client, threshold, urlTTL } = {}) {
    if (!bucket) {
      throw new WError('bucket is required');
    }

    this.bucket = bucket;
    this.threshold = threshold || DEFAULTS.THRESHOLD;
    this.urlTTL = urlTTL || DEFAULTS.URL_TTL;
    this.s3client = s3client || new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4'
    });
  }

  static _getByteSize(response) {
    return Buffer.byteLength(response.toString(), 'utf8');
  }

  static async _parseCompressedResponse(response) {
    try {
      const buf = Buffer.from(response.body, 'base64');
      const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(buf, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
      return new Response(JSON.parse(decompressed));
    } catch (e) {
      throw new WError({
        cause: e,
        info: response.body
      }, 'failed to parse compressed response');
    }
  }

  static async _parseResponse(response) {
    let parsed;
    switch (response.encoding) {
      case ENCODINGS.GZIP:
        parsed = await ResponseBuilder._parseCompressedResponse(response);
        break;
      case ENCODINGS.S3:
        parsed = await ResponseBuilder._parseS3Response(response);
        break;
      default:
        return response;
    }

    return ResponseBuilder._parseResponse(parsed);
  }

  static async _parseS3Response(response) {
    try {
      const result = await got(response.body);
      return new Response(JSON.parse(result.body));
    } catch (e) {
      throw new WError({
        cause: e,
        info: response.body
      }, 'failed to parse s3 response');
    }
  }

  static async fromAWSResponse(awsResponse) {
    let payload;
    try {
      payload = JSON.parse(awsResponse.Payload);
    } catch (err) {
      throw new WError(err, 'failed to parse response payload');
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
        encoding: errorDetails.encoding,
        body: errorDetails.body || errorDetails
      });
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'body')) {
      return new Response({
        statusCode: 200,
        body: payload
      });
    }

    const response = new Response(payload);
    return ResponseBuilder._parseResponse(response);
  }

  async _buildCompressedResponse(response) {
    try {
      const buf = Buffer.from(response.toString(), 'utf8');
      const compressedBody = await new Promise((resolve, reject) => {
        zlib.gzip(buf, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
      return new Response({
        statusCode: response.statusCode,
        encoding: ENCODINGS.GZIP,
        body: compressedBody.toString('base64')
      });
    } catch (e) {
      throw new WError(e, 'failed to compress response');
    }
  }

  _buildRawResponse({ body, encoding, statusCode } = {}) {
    return new Response({
      statusCode,
      encoding,
      body
    });
  }

  async _buildS3Response(response) {
    const key = uuid.v4();
    const putParams = {
      Body: response.toString(),
      Bucket: this.bucket,
      Key: key
    };

    try {
      await this.s3client.putObject(putParams).promise();
    } catch (e) {
      throw new WError({
        cause: e,
        info: putParams
      }, 'failed to upload response object to S3');
    }

    const getParams = {
      Bucket: this.bucket,
      Expires: this.urlTTL,
      Key: key
    };

    try {
      const url = await new Promise((resolve, reject) => {
        this.s3client.getSignedUrl('getObject', getParams, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });

      return new Response({
        statusCode: response.statusCode,
        encoding: ENCODINGS.S3,
        body: url
      });
    } catch (e) {
      throw new WError({
        cause: e,
        info: getParams
      }, 'failed to generate S3 pre-signed url');
    }
  }

  async build(options) {
    const rawResponse = this._buildRawResponse(options);
    if (ResponseBuilder._getByteSize(rawResponse) <= this.threshold) {
      return rawResponse;
    }

    const compressedResponse = await this._buildCompressedResponse(rawResponse);
    if (ResponseBuilder._getByteSize(compressedResponse) <= this.threshold) {
      return compressedResponse;
    }

    return this._buildS3Response(compressedResponse);
  }
}

module.exports = ResponseBuilder;
