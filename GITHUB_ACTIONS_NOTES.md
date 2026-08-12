GitHub Actions — Module Summary Notes

1. WHAT & WHY GITHUB ACTIONS?

• Simplify workflows and avoid repeated steps
• Implement logic that solves a problem not solved by any publicly available Action
• Create and share Actions with the community
• Actions are reusable units of code that can be used in GitHub Workflows

2. THREE TYPES OF GITHUB ACTIONS

A. COMPOSITE ACTIONS
—————————————————

What: Create custom Actions by combining multiple steps
• Composite Actions are like "Workflow Excerpts" — reusable chunks of a workflow
• Use Actions (via 'uses') and Commands (via 'run') as needed
• Useful for orchestrating multiple steps and sharing common workflow patterns

Example: cached-deps (Get and Cache Dependencies)

action.yml:
---
name: 'Get and Cache Dependencies'
description: 'Get the dependencies (via npm) and cache them'
inputs:
  caching:
    description: "Whether to cache deps or not"
    required: true
    default: 'true'
outputs:
  used-cache:
    description: whether cache used or not
    value: ${{ steps.set-output.outputs.cache_val }}
runs:
  using: 'composite'
  steps:
    - name: Cache dependencies
      if: inputs.caching == 'true'
      id: cache
      uses: actions/cache@v4
      with:
        path: node_modules
        key: deps-node-modules-${{ hashFiles('**/package-lock.json') }}
    - name: Install dependencies
      id: install
      if: steps.cache.outputs.cache-hit != 'true' || inputs.caching != 'true'
      shell: bash
      run: |
        npm ci
    - name: Set cache output
      id: set-output
      shell: bash
      run: |
        echo "cache_val=${{ steps.cache.outputs.cache-hit }}" >> "$GITHUB_OUTPUT"
---

Key Points:
• Multiple steps combined into a single reusable action
• Uses other actions (actions/cache@v4) and shell commands
• Accepts inputs (e.g., caching parameter)
• Produces outputs (e.g., used-cache) that can be used in workflows
• Each step has an id for reference in later steps
• Conditional execution using 'if' statements


B. JAVASCRIPT ACTIONS (Node.js)
———————————————————————————————

What: Write Action logic in JavaScript using Node.js runtime
• Use @actions/toolkit library for accessing inputs, outputs, and logging
• Best for quick, lightweight actions
• Executes directly without container overhead
• Uses 'node20' runtime

Example: deploy-s3-javascript (Deploy to AWS S3)

action.yml:
---
name: "deploy to AWS S3"
description: "deploy static website via AWS s3"
inputs:
  bucket:
    description: "The name of the s3 bucket"
    required: true
  bucket-region:
    description: "The region of the s3 bucket where it is hosted"
    required: false
    default: 'ap-south-1'
  dist-folder:
    description: 'The folder containing the deployable files'
    required: true
outputs:
  website-url:
    description: "The url of the deployed website via s3 bucket"
runs:
  using: 'node20'
  main: 'main.js'
---

main.js:
---
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
  exec.exec(`aws s3 sync ${distFolder} ${s3Uri} --region ${bucketRegion}`);

  // 3) get URL
  const websiteUrl = `http://${bucket}.s3-website.${bucketRegion}.amazonaws.com`
  core.setOutput('website-url', websiteUrl)
}

run();
---

Key Points:
• Get inputs using core.getInput()
• Execute shell commands using exec.exec()
• Set outputs using core.setOutput()
• Use core.notice(), core.warning(), core.error() for logging
• Runs directly in the Node.js environment (no container)
• Fast execution compared to Docker actions


C. DOCKER ACTIONS
—————————————————

What: Create custom Action environment with Docker
• Package application with all dependencies in a container
• Best for complex logic requiring specific tools/languages
• Slower than JavaScript but more flexible
• Can use any language (Python, Go, Bash, etc.)

Example: deploy-s3-docker (Deploy to AWS S3 using Docker)

action.yml:
---
name: 'Deploy to AWS S3 bucket'
description: 'copying files to s3 bucket for static website hosting'
inputs:
  bucket:
    description: "The name of the s3 bucket"
    required: true
  bucket-region:
    description: "The region of the s3 bucket where it is hosted"
    required: false
    default: 'ap-south-1'
  dist-folder:
    description: 'The folder containing the deployable files'
    required: true
outputs:
  website-url:
    description: "The url of the deployed website via s3 bucket"
runs:
  using: 'docker'
  image: 'Dockerfile'
---

Dockerfile:
---
FROM python:3.12-slim

WORKDIR /action

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY deployment.py .

ENTRYPOINT ["python", "/action/deployment.py"]
---

deployment.py:
---
import os
import boto3
from botocore.config import Config

def run():
    bucket = os.environ['INPUT_BUCKET']
    bucket_region = os.environ['INPUT_BUCKET-REGION']
    dist_folder = os.environ['INPUT_DIST-FOLDER']

    configuration = Config(region_name=bucket_region)
    s3_client = boto3.client('s3', config=configuration)

    for root, subdirs, files in os.walk(dist_folder):
        for file in files:
            s3_client.upload_file(os.path.join(root, file), bucket, file)

    website_url = f'http://{bucket}.s3-website-{bucket_region}.amazonaws.com'
    print(f'::set-output name=website-url::{website_url}')

if __name__ == '__main__':
    run()
---

Key Points:
• Inputs passed as environment variables (INPUT_<INPUT_NAME>)
• Outputs set using print(f'::set-output name=...::{value}')
• Runs inside a Docker container
• Dependencies installed in Dockerfile
• More overhead than JavaScript but allows any language/tools
• Better for complex deployments


3. COMPARISON MATRIX

                    | Composite  | JavaScript | Docker
—————————————————————|————————————|————————————|—————————
Speed               | N/A        | Fast       | Slow
Complexity          | Low        | Medium     | High
Language            | YAML       | JavaScript | Any
Use Case            | Orchestrate| Logic      | Complex logic
Startup Time        | Fast       | Fast       | Slow
Example             | Cache deps | AWS Deploy | AWS Deploy


4. HOW TO USE ACTIONS IN WORKFLOWS

Example from deploy.yml workflow:

steps:
  - name: Get code
    uses: actions/checkout@v4
  
  - name: Cache dependencies
    uses: ./.github/actions/cached-deps
    
  - name: Deploy site
    id: deploy
    uses: ./.github/actions/deploy-s3-javascript
    with:
      bucket: gha-custom-action-hosting-201298
      bucket-region: ap-south-1
      dist-folder: ./dist
    env:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    
  - name: Display URL
    run: echo "Live URL is: ${{ steps.deploy.outputs.website-url }}"

Key Syntax:
• uses: ./.github/actions/action-name — Local action
• uses: username/repo@version — Public action
• with: — Pass inputs to action
• env: — Pass environment variables
• id: — Reference action outputs in later steps
• ${{ steps.deploy.outputs.output-name }} — Access outputs


5. KEY TAKEAWAYS

• Composite Actions: For orchestrating multiple steps and creating reusable workflow patterns
• JavaScript Actions: For lightweight logic, fast execution, requires Node.js only
• Docker Actions: For complex logic, specific tools/languages, slower but more flexible
• All Actions follow same structure: inputs, outputs, runs configuration
• Actions promote code reuse and reduce duplication in workflows
• Choose action type based on complexity, performance needs, and dependencies
