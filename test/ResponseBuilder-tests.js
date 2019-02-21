'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiUUID = require('chai-uuid');
const nock = require('nock');
const { S3 } = require('aws-sdk');
const sinon = require('sinon');
const zlib = require('zlib');

const { Response, ResponseBuilder } = require('../');

chai.use(chaiAsPromised);
chai.use(chaiUUID);

const { expect } = chai;

const RESPONSE = new Response({
  statusCode: 500,
  encoding: 'test',
  body: {
    data: 'foo'
  }
});

describe('ResponseBuilder', function() {
  before(function() {
    this.sandbox = sinon.createSandbox();
  });

  beforeEach(function() {
    this.s3client = {
      putObject: this.sandbox.stub().returns({ promise: () => Promise.resolve() }),
      getSignedUrl: this.sandbox.stub().yields()
    };
    this.builder = new ResponseBuilder({
      bucket: 'test-bucket',
      s3client: this.s3client
    });
  });

  afterEach(function() {
    nock.cleanAll();
    this.sandbox.restore();
  });

  describe('#constructor', function() {
    it('should handle case when options object is not passed', function() {
      expect(() => new ResponseBuilder())
        .to.throw('bucket is required');
    });

    it('should handle case when bucket is not passed', function() {
      expect(() => new ResponseBuilder({}))
        .to.throw('bucket is required');
    });

    it('should use passed properties to initialize state', function() {
      const bucket = 'test-bucket';
      const s3client = { thisIsClient: true };
      const threshold = 12345;
      const urlTTL = 54321;
      const builder = new ResponseBuilder({
        bucket,
        s3client,
        threshold,
        urlTTL
      });

      expect(builder).to.have.property('bucket', bucket);
      expect(builder).to.have.property('threshold', threshold);
      expect(builder).to.have.property('urlTTL', urlTTL);
      expect(builder)
        .to.have.property('s3client')
        .that.is.deep.equal(s3client);
    });

    it('should use proper defaults to initialize state', function() {
      const bucket = 'test-bucket';
      const builder = new ResponseBuilder({ bucket });

      expect(builder).to.have.property('bucket', bucket);
      expect(builder).to.have.property('threshold', 6291456);
      expect(builder).to.have.property('urlTTL', 30);
      expect(builder)
        .to.have.property('s3client')
        .that.is.instanceof(S3);
    });
  });

  describe('#_getByteSize', function() {
    it('should calculate byte size correctly', function() {
      const size = ResponseBuilder._getByteSize(RESPONSE);

      expect(size).to.equal(58);
    });
  });

  describe('#_parseCompressedResponse', function() {
    it('should be able to handle compressed response', async function() {
      const compressed = await this.builder._buildCompressedResponse(RESPONSE);
      const parsed = await ResponseBuilder._parseCompressedResponse(compressed);

      expect(parsed).to.deep.equal(RESPONSE);
    });

    it('should throw when response is not base64 encoded', function() {
      const response = {
        body: {}
      };

      return expect(ResponseBuilder._parseCompressedResponse(response))
        .to.eventually.be.rejectedWith('failed to parse compressed response')
        .and.to.have.nested.property('jse_cause.message', 'First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.');
    });

    it('should throw when response is not gzip encoded', function() {
      const response = {
        body: Buffer.from('not gzip').toString('base64')
      };

      return expect(ResponseBuilder._parseCompressedResponse(response))
        .to.eventually.be.rejectedWith('failed to parse compressed response')
        .and.to.have.nested.property('jse_cause.message', 'incorrect header check');
    });

    it('should throw when decompressed response is not a valid JSON', async function() {
      const response = 'not a JSON';
      const compressed = await this.builder._buildCompressedResponse(response);

      return expect(ResponseBuilder._parseCompressedResponse(compressed))
        .to.eventually.be.rejectedWith('failed to parse compressed response')
        .and.to.have.nested.property('jse_cause.message', 'Unexpected token o in JSON at position 1');
    });
  });

  describe('#_parseResponse', function() {
    it('should be able to handle compressed response', async function() {
      const compressed = await this.builder._buildCompressedResponse(RESPONSE);
      const parsed = await ResponseBuilder._parseResponse(compressed);

      expect(parsed).to.deep.equal(RESPONSE);
    });

    it('should be able to handle S3 response', async function() {
      const url = 'https://test-url';

      this.s3client.getSignedUrl.yields(null, url);
      const request = nock(url).get('/').reply(200, RESPONSE.toString());

      const s3 = await this.builder._buildS3Response(RESPONSE);
      const parsed = await ResponseBuilder._parseResponse(s3);

      request.done();
      expect(parsed).to.deep.equal(RESPONSE);
    });

    it('should be able to handle raw response', async function() {
      const parsed = await ResponseBuilder._parseResponse(RESPONSE);

      expect(parsed).to.deep.equal(RESPONSE);
    });
  });

  describe('#_parseS3Response', function() {
    it('should be able to handle S3 response', async function() {
      const url = 'https://test-url';

      this.s3client.getSignedUrl.yields(null, url);
      const request = nock(url).get('/').reply(200, RESPONSE.toString());

      const s3 = await this.builder._buildS3Response(RESPONSE);
      const parsed = await ResponseBuilder._parseS3Response(s3);

      request.done();
      expect(parsed).to.deep.equal(RESPONSE);
    });

    it('should throw when S3 request fails', async function() {
      const url = 'https://test-url';

      this.s3client.getSignedUrl.yields(null, url);
      const request = nock(url).get('/').replyWithError('resource not found');

      const s3 = await this.builder._buildS3Response(RESPONSE);

      await expect(ResponseBuilder._parseS3Response(s3))
        .to.eventually.be.rejectedWith('failed to parse s3 response')
        .and.to.have.nested.property('jse_cause.message', 'resource not found');

      request.done();
    });

    it('should throw whe S3 response is not a valid JSON', async function() {
      const url = 'https://test-url';

      this.s3client.getSignedUrl.yields(null, url);
      const request = nock(url).get('/').reply(200, 'invalid');

      const s3 = await this.builder._buildS3Response(RESPONSE);

      await expect(ResponseBuilder._parseS3Response(s3))
        .to.eventually.be.rejectedWith('failed to parse s3 response')
        .and.to.have.nested.property('jse_cause.message', 'Unexpected token i in JSON at position 0');

      request.done();
    });
  });

  describe('#fromAWSResponse', function() {
    it('should throw when payload can`t be parsed', function() {
      const awsResponse = {
        Payload: ''
      };

      return expect(ResponseBuilder.fromAWSResponse(awsResponse))
        .to.be.rejectedWith('failed to parse response payload');
    });

    it('should use payload as body if payload is not an object', async function() {
      const payload = 'data';
      const awsResponse = {
        Payload: JSON.stringify(payload)
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 200);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body', payload);
    });

    it('should use payload as body if unhandled error is returned', async function() {
      const payload = {
        data: 'test data'
      };
      const awsResponse = {
        FunctionError: 'Unhandled',
        Payload: JSON.stringify(payload)
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(payload);
    });

    it('should use payload as body if handled error is returned, but payload has more than one field', async function() {
      const payload = {
        errorMessage: 'message',
        data: 'test data'
      };
      const awsResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify(payload)
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(payload);
    });

    it('should use payload as body if handled error is returned, but there is no errorMessage field in payload', async function() {
      const payload = {
        data: 'test data'
      };
      const awsResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify(payload)
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(payload);
    });

    it('should use errorMessage as body if handled error is returned, but errorMessage can`t be parsed', async function() {
      const payload = {
        errorMessage: 'abc'
      };
      const awsResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify(payload)
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.equals(payload.errorMessage);
    });

    it('should use parsed errorMessage as body if errorMessage can be parsed, but has no body field in it', async function() {
      const messageData = {
        data: 'some data'
      };
      const awsResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify({
          errorMessage: JSON.stringify(messageData)
        })
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(messageData);
    });

    it('should use parsed body and encoding fields from errorMessage if errorMessage can be parsed', async function() {
      const messageData = {
        body: { data: 'some data' },
        encoding: 'gzip'
      };
      const awsResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify({
          errorMessage: JSON.stringify(messageData)
        })
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', messageData.encoding);
      expect(response).to.have.property('body').that.deep.equals(messageData.body);
    });

    it('should use payload as body if there is no body field in it', async function() {
      const payload = {
        data: 'test data'
      };
      const awsResponse = {
        Payload: JSON.stringify(payload)
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', 200);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(payload);
    });

    it('should use statusCode, encoding and body from payload when present', async function() {
      const payload = {
        statusCode: 201,
        encoding: 'identity',
        body: {
          data: 'test data'
        }
      };
      const awsResponse = {
        Payload: JSON.stringify(payload)
      };

      const response = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(response).to.have.property('statusCode', payload.statusCode);
      expect(response).to.have.property('encoding', payload.encoding);
      expect(response).to.have.property('body').that.deep.equals(payload.body);
    });

    it('should use statusCode, encoding and body from falsy payload when present', async function() {
      const testPayload = {
        statusCode: 201,
        encoding: 'identity',
        body: false
      };
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = await ResponseBuilder.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', testPayload.statusCode);
      expect(response).to.have.property('encoding', testPayload.encoding);
      expect(response).to.have.property('body').that.deep.equals(testPayload.body);
    });

    it('should be able to handle compressed response', async function() {
      const compressed = await this.builder._buildCompressedResponse(RESPONSE);
      const awsResponse = {
        Payload: JSON.stringify(compressed)
      };

      const parsed = await ResponseBuilder.fromAWSResponse(awsResponse);

      expect(parsed).to.deep.equal(RESPONSE);
    });

    it('should be able to handle S3 response', async function() {
      const url = 'https://test-url';

      this.s3client.getSignedUrl.yields(null, url);
      const request = nock(url).get('/').reply(200, RESPONSE.toString());

      const s3 = await this.builder._buildS3Response(RESPONSE);
      const awsResponse = {
        Payload: JSON.stringify(s3)
      };

      const parsed = await ResponseBuilder.fromAWSResponse(awsResponse);

      request.done();
      expect(parsed).to.deep.equal(RESPONSE);
    });
  });

  describe('#_buildCompressedResponse', function() {
    it('should be able to create compressed response', async function() {
      const compressed = await this.builder._buildCompressedResponse(RESPONSE);

      expect(compressed).to.have.property('statusCode', RESPONSE.statusCode);
      expect(compressed).to.have.property('encoding', 'gzip');
      expect(compressed).to.have.property('body');

      const decodedBody = JSON.parse(zlib.gunzipSync(Buffer.from(compressed.body, 'base64')));
      expect(decodedBody).to.deep.equal(RESPONSE);
    });

    it('should throw when compression fails', function() {
      const error = new Error('compression error');

      this.sandbox.stub(zlib, 'gzip').yields(error);

      return expect(this.builder._buildCompressedResponse(RESPONSE))
        .to.eventually.be.rejectedWith('failed to compress response')
        .and.to.have.nested.property('jse_cause.message', error.message);
    });
  });

  describe('#_buildRawResponse', function() {
    it('should be able to create raw response', async function() {
      const response = this.builder._buildRawResponse(RESPONSE);

      expect(response).to.be.an.instanceof(Response);
      expect(response).to.have.property('statusCode', RESPONSE.statusCode);
      expect(response).to.have.property('encoding', RESPONSE.encoding);
      expect(response)
        .to.have.property('body')
        .that.is.deep.equal(RESPONSE.body);
    });

    it('should handle case when options are not passed', async function() {
      const response = this.builder._buildRawResponse();

      expect(response).to.be.an.instanceof(Response);
    });
  });

  describe('#_buildS3Response', function() {
    it('should be able to create compressed response', async function() {
      const url = 'https://test-url';

      this.s3client.getSignedUrl.yields(null, url);

      const s3 = await this.builder._buildS3Response(RESPONSE);

      expect(s3).to.be.an.instanceof(Response);

      expect(s3).to.have.property('statusCode', RESPONSE.statusCode);
      expect(s3).to.have.property('encoding', 's3');
      expect(s3).to.have.property('body', url);

      sinon.assert.calledOnce(this.s3client.putObject);

      const putParams = this.s3client.putObject.firstCall.args[0];
      expect(putParams).to.have.property('Bucket', this.builder.bucket);
      expect(putParams).to.have.property('Body', RESPONSE.toString());
      expect(putParams)
        .to.have.property('Key')
        .that.is.a.uuid('v4');

      sinon.assert.calledOnce(this.s3client.getSignedUrl);

      const getArgs = this.s3client.getSignedUrl.firstCall.args;
      expect(getArgs[0]).to.be.equal('getObject');
      expect(getArgs[1]).to.have.property('Bucket', this.builder.bucket);
      expect(getArgs[1]).to.have.property('Expires', this.builder.urlTTL);
      expect(getArgs[1]).to.have.property('Key', putParams.Key);
    });

    it('should throw when putObject call fails', function() {
      const error = new Error('upload error');

      this.s3client.putObject.returns({
        promise: () => Promise.reject(error)
      });

      return expect(this.builder._buildS3Response(RESPONSE))
        .to.eventually.be.rejectedWith('failed to upload response object to S3')
        .and.to.have.nested.property('jse_cause.message', error.message);
    });

    it('should throw when getSignedUrl call fails', function() {
      const error = new Error('upload error');

      this.s3client.getSignedUrl.yields(error);

      return expect(this.builder._buildS3Response(RESPONSE))
        .to.eventually.be.rejectedWith('failed to generate S3 pre-signed url')
        .and.to.have.nested.property('jse_cause.message', error.message);
    });
  });

  describe('#build', function() {
    it('should build raw response when its size is lower than threshold', function () {
      this.builder.threshold = 1000;

      const responseData = {
        statusCode: 500,
        encoding: 'test',
        body: {
          data: 'foo'
        }
      };

      return expect(this.builder.build(responseData))
        .to.eventually.be.an.instanceof(Response)
        .and.to.have.property('encoding', responseData.encoding);
    });

    it('should build compressed response when when raw response is larger than threshold', function () {
      this.builder.threshold = 1000;

      const responseData = {
        statusCode: 500,
        encoding: 'test',
        body: {
          data: new Array(1000).fill('a')
        }
      };

      return expect(this.builder.build(responseData))
        .to.eventually.be.an.instanceof(Response)
        .and.to.have.property('encoding', 'gzip');
    });

    it('should build s3 response when when compressed response is larger than threshold', function () {
      this.builder.threshold = 50;

      const responseData = {
        statusCode: 500,
        encoding: 'test',
        body: {
          data: new Array(1000).fill('a')
        }
      };

      return expect(this.builder.build(responseData))
        .to.eventually.be.an.instanceof(Response)
        .and.to.have.property('encoding', 's3');
    });
  });
});
