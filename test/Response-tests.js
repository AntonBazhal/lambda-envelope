'use strict';

const expect = require('chai').expect;
const WError = require('verror').WError;

const Response = require('../').Response;

describe('Response', function() {
  describe('#constructor', function() {
    it('should handle case when options object is not passed', function() {
      const response = new Response();
      expect(response).to.have.property('body').that.deep.equals({});
      expect(response).to.have.property('statusCode', 200);
    });
  });

  describe('#toJSON', function() {
    it('should return proper JSON object', function() {
      const testBody = { data: 'some data' };
      const testStatusCode = 200;

      const response = new Response({
        body: testBody,
        statusCode: testStatusCode
      });

      expect(response.toJSON()).to.be.deep.equal({
        body: testBody,
        statusCode: testStatusCode
      });
    });
  });

  describe('#toString', function() {
    it('should return proper stringified representation', function() {
      const testBody = { data: 'some data' };
      const testStatusCode = 200;

      const response = new Response({
        body: testBody,
        statusCode: testStatusCode
      });

      const expectedResult = JSON.stringify({
        body: testBody,
        statusCode: testStatusCode
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
        .to.throw(WError, /failed to parse payload/);
    });

    it('should use payload as body if payload is not an object', function() {
      const testPayload = 'data';
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('body', testPayload);
      expect(response).to.have.property('statusCode', 200);
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

      expect(response).to.have.property('body').that.deep.equals(testPayload);
      expect(response).to.have.property('statusCode', 500);
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

      expect(response).to.have.property('body').that.deep.equals(testPayload);
      expect(response).to.have.property('statusCode', 500);
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

      expect(response).to.have.property('body').that.deep.equals(testPayload);
      expect(response).to.have.property('statusCode', 500);
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

      expect(response).to.have.property('body').that.equals(testPayload.errorMessage);
      expect(response).to.have.property('statusCode', 500);
    });

    it('should use parsed errorMessage as body if errorMessage can be parsed', function() {
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

      expect(response).to.have.property('body').that.deep.equals(messageData);
      expect(response).to.have.property('statusCode', 500);
    });

    it('should use payload as body if there is no body field in it', function() {
      const testPayload = {
        data: 'test data'
      };
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('body').that.deep.equals(testPayload);
      expect(response).to.have.property('statusCode', 200);
    });

    it('should use statusCode and body from payload when present', function() {
      const testPayload = {
        statusCode: 201,
        body: {
          data: 'test data'
        }
      };
      const testAWSResponse = {
        Payload: JSON.stringify(testPayload)
      };

      const response = Response.fromAWSResponse(testAWSResponse);

      expect(response).to.have.property('body').that.deep.equals(testPayload.body);
      expect(response).to.have.property('statusCode', testPayload.statusCode);
    });
  });
});
