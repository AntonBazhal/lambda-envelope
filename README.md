# lambda-envelope

[![Build Status][ci-image]][ci-url]
[![Coverage Status][coverage-image]][coverage-url]
[![NPM version][npm-image]][npm-url]
[![Dependencies Status][dependencies-image]][dependencies-url]
[![DevDependencies Status][devdependencies-image]][devdependencies-url]

Envelope for [AWS Lambda][aws-lambda-url] responses that supports raw invocation response parsing.

## Installation

```bash
$ npm install lambda-envelope
```

## Usage

### Response

[AWS Lambda][aws-lambda-url] does not provide a way to separate client and server errors, as errors can't be extended with custom fields. `Response` class contains methods needed by [AWS Lambda][aws-lambda-url] to correctly serialize custom response or error. Successful results and client errors should be returned using [success callback](lambda-callback-url). Errors that should be treated as server errors and, as a result, be picked up by [Amazon CloudWatch][cloudwatch-url], must be returned using [error callback](lambda-callback-url).

#### constructor(options)
Constructor takes options object with optional parameters:

- **[statusCode]** - response status code that should match HTTP status codes, but can be any proprietary value [defaults to **`200`**]
- **[encoding]** - response body encoding [defaults to **`identity`**]
- **[body]** - response body (can be of any type that is `JSON.stringify` compatible) [defaults to **`{}`**]

##### Example
```js
const Response = require('lambda-envelope').Response;

module.exports.handler = function(event, context, callback) {
  const response = new Response({
    statusCode: 200,
    body: {
      data: 'some data'
    }
  });

  callback(null, response);
}
```

### ResponseBuilder

`ResponseBuilder` is a factory class that helps to deal with large response size, since [AWS Lambda][aws-lambda-url] has a [6 MB max response size][aws-lambda-limits-url] (256 KB in the asynchronous mode). It tries to compress the response when it exceeds pre-defined threshold and uploads compressed response to S3 bucket when compression does not bring response size below threshold (returning pre-signed URL). Additionally, `ResponseBuilder` class contains helper method to parse raw [AWS Lambda][aws-lambda-url] response.

#### constructor(options)
Constructor takes options object with the following parameters:
- **bucket** - S3 bucket name to upload large responses to. This bucket should have lifecycle policy in place to cleanup old responses as soon as possible
- **[s3client]** - an optional instance of [AWS S3 client][aws-s3-client-url] to use
- **[threshold]** - an optional threshold in bytes to use for compression or S3 upload [defaults to **`6291456 (6 MB)`**]
- **[urlTTL]** - an optional [pre-signed S3 URL][aws-s3-get-signed-url] expiration time in seconds [defaults to **`30`**]

##### Example
```js
const AWS = require('aws-sdk');
const ResponseBuilder = require('lambda-envelope').ResponseBuilder;

const builder = new ResponseBuilder({
  bucket: 'bucket-for-responses',
  s3client: new AWS.S3({ maxRetries: 5 }),
  threshold: 256
  urlTTL: 60
});

module.exports.handler = function(event, context, callback) {
  const builder = new ResponseBuilder({
    bucket: 'bucket-for-responses',
    threshold: 256
  });

  const response = builder.build({
    statusCode: 200,
    body: {
      data: 'some data'
    }
  });

  callback(null, response);
}
```

#### build(options)
Creates and instance of `Response` with the following parameters:

- **[statusCode]** - response status code that should match HTTP status codes, but can be any proprietary value [defaults to **`200`**]
- **[encoding]** - response body encoding [defaults to **`identity`**]
- **[body]** - response body (can be of any type that is `JSON.stringify` compatible) [defaults to **`{}`**]

##### Example
```js
const ResponseBuilder = require('lambda-envelope').ResponseBuilder;

const builder = new ResponseBuilder({
  bucket: 'bucket-for-responses'
});

module.exports.handler = function(event, context, callback) {
  const response = builder.build({
    statusCode: 200,
    body: {
      data: 'some data'
    }
  });

  callback(null, response);
}
```

#### fromAWSResponse(awsResponse)
Method that handles raw [AWS Lambda][aws-lambda-url] invocation response parsing, including compressed and S3 responses.

##### Example
```js
const AWS = require('aws-sdk');
const ResponseBuilder = require('lambda-envelope').ResponseBuilder;

const lambda = new AWS.Lambda();
const params = {
  FunctionName: 'function-to-be-invoked',
  Payload: JSON.stringify({})
};

return lambda.invoke(params)
  .promise()
  .then(rawResponse => ResponseBuilder.fromAWSResponse(rawResponse))
  .then(response => {
    if (response.statusCode === 200) {
      /*success*/
    } else {
      /*error*/
    }
  });
```

## License

The MIT License (MIT)

Copyright (c) 2017-2019 Anton Bazhal

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[aws-lambda-url]: https://aws.amazon.com/lambda/details/
[aws-lambda-limits-url]: https://docs.aws.amazon.com/lambda/latest/dg/limits.html
[aws-s3-client-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
[aws-s3-get-signed-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
[ci-image]: https://circleci.com/gh/AntonBazhal/lambda-envelope.svg?style=shield&circle-token=f6c189b6f4e3d0e664a7947ec3e7c7e5086af079
[ci-url]: https://circleci.com/gh/AntonBazhal/lambda-envelope
[cloudwatch-url]: https://aws.amazon.com/cloudwatch/
[coverage-image]: https://coveralls.io/repos/github/AntonBazhal/lambda-envelope/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/AntonBazhal/lambda-envelope?branch=master
[dependencies-url]: https://david-dm.org/antonbazhal/lambda-envelope
[dependencies-image]: https://david-dm.org/antonbazhal/lambda-envelope/status.svg
[devdependencies-url]: https://david-dm.org/antonbazhal/lambda-envelope?type=dev
[devdependencies-image]: https://david-dm.org/antonbazhal/lambda-envelope/dev-status.svg
[lambda-callback-url]: http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html#nodejs-prog-model-handler-callback
[npm-url]: https://www.npmjs.org/package/lambda-envelope
[npm-image]: https://img.shields.io/npm/v/lambda-envelope.svg
