/* eslint-disable node/no-process-env */
import { TurborepoRemoteCache } from '.'
import type { StackProps } from 'aws-cdk-lib'
import {
  App,
  aws_certificatemanager,
  aws_cloudfront,
  aws_cloudfront_origins,
  aws_route53,
  aws_route53_targets,
  Duration,
  Fn,
  Stack,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import * as fs from 'node:fs'
import * as path from 'node:path'

const zoneName = 'github.nimmervoll.work'
const domainName = 'cache.github.nimmervoll.work'

const app = new App()

class CertificatesStack extends Stack {
  public readonly certificate: aws_certificatemanager.Certificate

  public constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const hostedZone = aws_route53.PublicHostedZone.fromLookup(
      this,
      'HostedZone',
      {
        domainName: zoneName,
      }
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

const { certificate } = new CertificatesStack(
  app,
  'cdk-turborepo-remote-cache-certificate',
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1',
    },
  }
)

const stack = new Stack(app, 'cdk-turborepo-remote-cache', {
  crossRegionReferences: true,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
})

const secretToken = fs
  .readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
  .split('TURBO_TOKEN=')[1]
  .split('\n')[0]
  .trim()

const { functionUrl, bucket } = new TurborepoRemoteCache(
  stack,
  'TurborepoCache',
  {
    secretToken,
  }
)

bucket.addLifecycleRule({
  expiration: Duration.days(7),
})

const zone = aws_route53.PublicHostedZone.fromLookup(stack, 'HostedZone', {
  domainName: zoneName,
})

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
