'use strict';

const expect = require('chai').expect;

const Response = require('../').Response;

describe('Response', function() {
  describe('#constructor', function() {
    it('should handle case when options object is not passed', function() {
      const response = new Response();
      expect(response).to.have.property('statusCode', 200);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals({});
    });

    it('should handle case when options body is set to false', function() {
      const response = new Response({ body: false });
      expect(response).to.have.property('statusCode', 200);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.equals(false);
    });
  });

  describe('#toJSON', function() {
    it('should return proper JSON object', function() {
      const testBody = { data: 'some data' };
      const testEncoding = 'gzip';
      const testStatusCode = 200;

      const response = new Response({
        statusCode: testStatusCode,
        encoding: testEncoding,
        body: testBody
      });

      expect(response.toJSON()).to.be.deep.equal({
        statusCode: testStatusCode,
        encoding: testEncoding,
        body: testBody
      });
    });
  });

  describe('#toString', function() {
    it('should return proper stringified representation', function() {
      const testBody = { data: 'some data' };
      const testEncoding = 'gzip';
      const testStatusCode = 200;

      const response = new Response({
        statusCode: testStatusCode,
        encoding: testEncoding,
        body: testBody
      });

      const expectedResult = JSON.stringify({
        statusCode: testStatusCode,
        encoding: testEncoding,
        body: testBody
      });

      expect(response.toString()).to.be.equal(expectedResult);
    });
  });

  describe('#fromAWSResponse', function() {
    it('should throw when payload can`t be parsed', function() {
      const testAWSResponse = {
        Payload: ''
      };

      expect(() => Response.fromAWSResponse(testAWSResponse))
        .to.throw('failed to parse response payload');
    });

    it('should use payload as body if payload is not an object', function() {
      const testPayload = 'data';
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 200);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body', testPayload);
    });

    it('should use payload as body if unhandled error is returned', function() {
      const testPayload = {
        data: 'test data'
      };
      const testAWSResponse = {
        FunctionError: 'Unhandled',
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(testPayload);
    });

    it('should use payload as body if handled error is returned, but payload has more than one field', function() {
      const testPayload = {
        errorMessage: 'message',
        data: 'test data'
      };
      const testAWSResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(testPayload);
    });

    it('should use payload as body if handled error is returned, but there is no errorMessage field in payload', function() {
      const testPayload = {
        data: 'test data'
      };
      const testAWSResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(testPayload);
    });

    it('should use errorMessage as body if handled error is returned, but errorMessage can`t be parsed', function() {
      const testPayload = {
        errorMessage: 'abc'
      };
      const testAWSResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.equals(testPayload.errorMessage);
    });

    it('should use parsed errorMessage as body if errorMessage can be parsed, but has no body field in it', function() {
      const messageData = {
        data: 'some data'
      };
      const testAWSResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify({
          errorMessage: JSON.stringify(messageData)
        })
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(messageData);
    });

    it('should use parsed body and encoding fields from errorMessage if errorMessage can be parsed', function() {
      const messageData = {
        body: { data: 'some data' },
        encoding: 'gzip'
      };
      const testAWSResponse = {
        FunctionError: 'Handled',
        Payload: JSON.stringify({
          errorMessage: JSON.stringify(messageData)
        })
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 500);
      expect(response).to.have.property('encoding', messageData.encoding);
      expect(response).to.have.property('body').that.deep.equals(messageData.body);
    });

    it('should use payload as body if there is no body field in it', function() {
      const testPayload = {
        data: 'test data'
      };
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', 200);
      expect(response).to.have.property('encoding', 'identity');
      expect(response).to.have.property('body').that.deep.equals(testPayload);
    });

    it('should use statusCode, encoding and body from payload when present', function() {
      const testPayload = {
        statusCode: 201,
        encoding: 'gzip',
        body: {
          data: 'test data'
        }
      };
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', testPayload.statusCode);
      expect(response).to.have.property('encoding', testPayload.encoding);
      expect(response).to.have.property('body').that.deep.equals(testPayload.body);
    });

    it('should use statusCode, encoding and body from falsy payload when present', function() {
      const testPayload = {
        statusCode: 201,
        encoding: 'gzip',
        body: false
      };
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('statusCode', testPayload.statusCode);
      expect(response).to.have.property('encoding', testPayload.encoding);
      expect(response).to.have.property('body').that.deep.equals(testPayload.body);
    });
  });
});
