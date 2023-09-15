import type { Stack } from 'aws-cdk-lib'
import {
  aws_iam,
  aws_lambda,
  aws_s3,
  CfnOutput,
  Duration,
  Fn,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as path from 'node:path'

export interface TurborepoRemoteCacheProps {
  /**
   * An existing bucket to use for hosting the cache.
   * @default create a new bucket
   */
  readonly bucket?: aws_s3.Bucket

  /**
   * The secret token to use for authenticating requests.
   */
  readonly secretToken: string
}

export class TurborepoRemoteCache extends Construct {
  /**
   * The lambda handler function.
   */
  public lambdaHandler: aws_lambda.Function

  /**
   * The bucket used for hosting the cache.
   */
  public bucket: aws_s3.Bucket

  /**
   * The URL of the lambda function.
   */
  public functionUrl: aws_lambda.FunctionUrl

  public constructor(
    scope: Stack,
    id: string,
    props: TurborepoRemoteCacheProps
  ) {
    super(scope, id)

    this.bucket = props.bucket ?? new aws_s3.Bucket(this, 'Bucket', {})

    this.lambdaHandler = new aws_lambda.Function(this, 'Handler', {
      code: aws_lambda.Code.fromAsset(path.join(__dirname, '../lib/lambda')),
      description: 'API Handler for Turborepo Remote Cache',
      environment: {
        STORAGE_PATH: this.bucket.bucketName,
        STORAGE_PROVIDER: 's3',
        TURBO_TOKEN: props.secretToken,
      },
      handler: 'index.handler',
      memorySize: 512,
      runtime: new aws_lambda.Runtime(
        // 'nodejs18.x',
        'nodejs16.x',
        aws_lambda.RuntimeFamily.NODEJS
      ),
      timeout: Duration.seconds(10),
    })

    this.lambdaHandler.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ['s3:*'],
        resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
      })
    )

    this.functionUrl = this.lambdaHandler.addFunctionUrl({
      authType: aws_lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedHeaders: ['*'],
        allowedMethods: [aws_lambda.HttpMethod.ALL],
        allowedOrigins: ['*'],
      },
    })

    new CfnOutput(this, 'CacheUrl', {
      value: `${Fn.select(0, Fn.split('on.aws/', this.functionUrl.url))}on.aws`,
    })
  }
}
