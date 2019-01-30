'use strict';

const { expect } = require('chai');

const { Response } = require('../');

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
      const body = { data: 'some data' };
      const encoding = 'gzip';
      const statusCode = 200;

      const response = new Response({
        statusCode,
        encoding,
        body
      });

      expect(response.toJSON()).to.be.deep.equal({
        statusCode,
        encoding,
        body
      });
    });
  });

  describe('#toString', function() {
    it('should return proper stringified representation', function() {
      const body = { data: 'some data' };
      const encoding = 'gzip';
      const statusCode = 200;

      const response = new Response({
        statusCode,
        encoding,
        body
      });

      const expectedResult = JSON.stringify({
        statusCode,
        encoding,
        body
      });

      expect(response.toString()).to.be.equal(expectedResult);
    });
  });
});
