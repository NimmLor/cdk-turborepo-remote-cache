<h1 align="center">📦 cdk-turborepo-remote-cache</h1>

[![npm version](https://badge.fury.io/js/cdk-turborepo-remote-cache.svg)](https://npmjs.com/package/cdk-turborepo-remote-cache)
![Pipeline](https://github.com/NimmLor/cdk-turborepo-remote-cache/actions/workflows/release.yml/badge.svg)

A simple setup of [turborepo-remote-cache](https://github.com/ducktors/turborepo-remote-cache) for aws-cdk.
The construct creates an S3 bucket and a lambda function that will provide an api for turborepo to use as a remote cache. This setup works without the need for an API Gateway HTTP API.

Read more about turborepo remote caching in their [docs](https://turbo.build/repo/docs/core-concepts/remote-caching).

## Installing

Note: requires **aws-cdk: "^2.51.0"**

```properties
yarn add cdk-turborepo-remote-cache
```

## Usage

Include it anywhere in your stack. The api url will be printed to the console after deployment.

```ts
import { type StackProps, Stack, Duration } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import { TurborepoRemoteCache } from 'cdk-turborepo-remote-cache'

export class AwesomeStack extends Stack {
  public constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const secretToken = '<your secret token>'

    new TurborepoRemoteCache(this, 'TurborepoCache', {
      secretToken,
    })
  }
}
```

## Integrate into turborepo

1. Create a `.turbo/config.json` file in the root of your repository.

**Note:** The teamid must start with `team_` and the apiurl must be the url of the lambda function without the trailing slash.

```json
{
  "teamid": "team_hello-world",
  "apiurl": "<your api url>"
}
```

2. Create an `.env` or `.env.local` file in the root of your repository. It will be used by turborepo to authenticate with the api.

```properties
TURBO_TOKEN=<your secret token>
```

3. Start using turborepo

## Advanced usage

For a more advanced setup you can take a look at [./src/integ.default.ts](./src/integ.default.ts)

### Loading the secret token from `.env`

```ts
const secretToken = fs
  .readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
  .split('TURBO_TOKEN=')[1]
  .split('\n')[0]
  .trim()

new TurborepoRemoteCache(this, 'TurborepoCache', {
  secretToken,
})
```

### Using an existing bucket

```ts
const bucket = Bucket.fromBucketName(this, 'Bucket', '<your bucket name>')

new TurborepoRemoteCache(this, 'TurborepoCache', {
  secretToken: '<your secret token>',
  bucket,
})
```

### Setting a TTL for the cache

```ts
const { bucket } = new TurborepoRemoteCache(this, 'TurborepoCache', {
  secretToken: '<your secret token>',
})

bucket.addLifecycleRule({
  expiration: Duration.days(7),
})
```

### Using a custom domain

To use a custom domain you need to create a certificate in us-east-1 and a cloudfront distribution in the region of your choice. The fully qualified domain name of the lambda function url will be used as the origin for the cloudfront distribution.

```ts
const account = 123456789012
// The name of the existing hosted zone in Route53
const zoneName = 'github.nimmervoll.work'
// The name of the domain you want to use for the cache
const domainName = 'cache.github.nimmervoll.work'

class CertificatesStack extends Stack {
  public readonly certificate: aws_certificatemanager.Certificate

  public constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const hostedZone = aws_route53.PublicHostedZone.fromLookup(
      this,
      'HostedZone',
      { domainName: zoneName }
    )

    this.certificate = new aws_certificatemanager.Certificate(
      this,
      'Certificate',
      {
        domainName,
        validation:
          aws_certificatemanager.CertificateValidation.fromDns(hostedZone),
      }
    )
  }
}

// Create a certificate in us-east-1
// Note: DnsValidatedCertificate is deprecated,
// the new standard is to use Certificate in a stack in us-east-1
const { certificate } = new CertificatesStack(
  app,
  'cdk-turborepo-remote-cache-certificate',
  {
    env: {
      account,
      // This stack must be in us-east-1 because cloudfront requires it
      region: 'us-east-1',
    },
  }
)

// Create your app stack in any region
const stack = new Stack(app, 'cdk-turborepo-remote-cache', {
  crossRegionReferences: true,
  env: {
    account,
    region: 'eu-central-1',
  },
})

const { functionUrl } = new TurborepoRemoteCache(stack, 'TurborepoCache', {
  secretToken: '<your secret token>',
})

const hostedZone = aws_route53.PublicHostedZone.fromLookup(
  stack,
  'HostedZone',
  {
    domainName: zoneName,
  }
)

// this removes the https:// and the trailing slash from the function url
const functionUrlfqdn = Fn.select(2, Fn.split('/', functionUrl.url))

const distribution = new aws_cloudfront.Distribution(stack, 'Cache', {
  certificate,
  defaultBehavior: {
    origin: new aws_cloudfront_origins.HttpOrigin(functionUrlfqdn),
  },
  domainNames: [domainName],
})

new aws_route53.ARecord(stack, 'CacheRecord', {
  recordName: `${domainName}.`,
  target: aws_route53.RecordTarget.fromAlias(
    new aws_route53_targets.CloudFrontTarget(distribution)
  ),
  zone,
})
```

## Notes

- The [docs of turborepo-remote-cache](cdk-turborepo-remote-cache) tell you to use an API Gateway HTTP API, however a way simpler approach is to use the lambda function url directly. This is what this construct does.
- The lambda function still uses Node.js 16.x because `turborepo-remote-cache` still relies on `aws-sdk v2` which is is not available in Node.js 18.x.
- Cloudfront is required for the custom domain setup because the lambda function url cannot be used as a CNAME record.
- Security could be vastly improved. Setting the secret token as an environment variable is a bad idea. An option would be to store a pdkdf2 hash instead of the plaintext secret token. The best way in my opinion would be to use a jwk to sign a long lived jwt token that defines the teamid. This would allow to grant fine grained access to the cache as described [this issue](https://github.com/ducktors/turborepo-remote-cache/issues/167).
- The code from `turborepo-remote-cache` could be rewritten using [Jeremy Dalys lambda-api](https://github.com/jeremydaly/lambda-api) to reduce the bundle size and improve performance.

## Author

👤 Lorenz Nimmervoll - @Nimmlor
