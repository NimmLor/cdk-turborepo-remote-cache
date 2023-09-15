import { TurborepoRemoteCache } from '../src'
import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

const blankApp = new App()
const blankStack = new Stack(blankApp)

new TurborepoRemoteCache(blankStack, 'TurborepoCache', {
  secretToken: 'foo',
})

const blankTemplate = Template.fromStack(blankStack)

describe('Cloudformation Template validation', () => {
  it('includes the lambda function', () => {
    blankTemplate.hasResourceProperties('AWS::Lambda::Function', {
      // Runtime: 'nodejs18.x',
      Runtime: 'nodejs16.x',
    })
  })
})
