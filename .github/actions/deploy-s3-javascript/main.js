const core = require('@actions/core')
const exec = require('@actions/exec')
const github = require('@actions/github')

function run() {
  //1) Get some information related to the bucket
  const bucket = core.getInput('bucket', { required: true })
  const bucketRegion = core.getInput('bucket-region', { required: true })
  const distFolder = core.getInput('dist-folder', { required: true })
  core.notice('Hello from My custom Javascript Action');

  // 2) Upload files
  const s3Uri = `s3://${bucket}`
  exec.exec(`aws s3 sync ${distFolder}} ${s3Uri} --region ${bucketRegion}`);
}

run();

