import {
  EslintConfig,
  GitConfig,
  PrettierConfig,
  VscodeConfig,
} from '@atws/projen-config'
import { awscdk } from 'projen'
import { NodePackageManager } from 'projen/lib/javascript'

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Lorenz Nimmervoll',
  authorAddress: 'admin@nimmervoll.work',

  cdkVersion: '2.51.0',
  defaultReleaseBranch: 'main',
  deps: [],
  description: 'Deploy turborepo-remote-cache serverless on aws',

  devDeps: ['esbuild', '@atws/projen-config', 'turborepo-remote-cache'],
  eslint: false,

  jsiiVersion: '~5.0.0',

  keywords: ['cdk', 'awscdk', 'aws-cdk', 'turborepo', 'remote-cache'],

  name: 'cdk-turborepo-remote-cache',

  packageManager: NodePackageManager.YARN2,

  packageName: 'cdk-turborepo-remote-cache',

  projenrcTs: true,
  repositoryUrl: 'https://github.com/NimmLor/cdk-turborepo-remote-cache.git',

  workflowNodeVersion: '18.x',
})

new PrettierConfig(project)

new EslintConfig(project, {
  ignorePaths: ['lib/**/*'],
  projenFileRegex: '{src,test,lambda}/**/*.ts',
})
  .getFiles()
  .eslintConfig.addOverride('overrides.0.parserOptions.tsconfigRootDir', './')

new VscodeConfig(project, {
  vscodeExtensions: {
    addCdkExtensions: false,
    addCoreExtensions: false,
    addNodeExtensions: false,
  },
})

const ignorePatterns = [
  'cache',
  'install-state.gz',
  '!frontend/tsconfig.json',
  'frontend/dist',
  '.env.local',
  'cdk.out',
  '.yarn',
]

new GitConfig(project)
project.gitignore.addPatterns(...ignorePatterns)
project.npmignore?.addPatterns(
  ...ignorePatterns,
  '.editorconfig',
  '.eslintignore',
  '.eslintrc',
  '.gitattributes',
  '.prettierrc.js',
  '.projenrc.ts',
  '.yarn',
  '.yarnrc.yml',
  'lambda',
  'frontend',
  '!lib/lambda',
  '!lib/lambda/frontend/index.html',
  '!lib',
  'dist',
  'logo.png',
  'ui.png',
  'yarn-error.log',
  'tsconfig.tsbuildinfo'
)

// const external = "@aws-sdk/*"
const external = 'aws-sdk'

const buildLambdaCommand = `esbuild lambda/src/index.ts --bundle --outdir=lib/lambda --platform=node --external":${external}" --minify --target=ES2022 --format=cjs`

const buildTask = project.preCompileTask

buildTask.exec(buildLambdaCommand)

project.setScript('cdk', 'cdk')

project.setScript(
  'e2e',
  'yarn build && yarn cdk deploy --all --app "./lib/integ.default.js" --require-approval never --outputs-file ./cdk.out/integ-outputs.json'
)

project.synth()
