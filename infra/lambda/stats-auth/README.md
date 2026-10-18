# stats-auth

The sign-in check for [stats.mvcprogrammer.com](https://stats.mvcprogrammer.com): a Lambda@Edge
viewer-request function that lets a request through only with a valid Amazon Cognito session, using
the [cognito-at-edge](https://github.com/awslabs/cognito-at-edge) library. Without a session the
visitor is sent to the user pool's hosted sign-in page; on the way back the code is exchanged for
tokens, which are stored as `HttpOnly; Secure; SameSite=Lax` cookies for 30 days. `/signout` revokes
them. Because the day files sit behind the same distribution, a data URL needs the session too.

Lambda@Edge has no environment variables, so the function reads its configuration from SSM
Parameter Store in us-east-1 once per container:

| Parameter | Type | Value |
| --- | --- | --- |
| `/mvcprogrammer/stats/user-pool-id` | String | the user pool id, `us-east-1_...` |
| `/mvcprogrammer/stats/user-pool-app-id` | String | the app client id (no client secret) |
| `/mvcprogrammer/stats/user-pool-domain` | String | the hosted UI domain, `<prefix>.auth.us-east-1.amazoncognito.com` |
| `/mvcprogrammer/stats/nonce-secret` | SecureString | a random string for the sign-in CSRF nonce (`openssl rand -hex 32`) |

If any parameter is missing the function answers 503 and logs the reason; it never lets a request
through because the check broke.

## Deploy

Lambda@Edge functions live in us-east-1, are attached by version (not `$LATEST`), and a
viewer-request package must stay under 1 MB compressed. `cognito-at-edge` with its dependencies
zips to 1.5 MB as installed, so `npm run build` bundles and minifies everything into one file with
esbuild (the AWS SDK stays external; it is in the runtime), and the zip comes in under 100 KB.

```bash
cd infra/lambda/stats-auth
npm ci
npm test
npm run package                       # dist/index.js, then stats-auth.zip (about 100 KB)

# One time: the execution role, trusted by both Lambda and Lambda@Edge, allowed to read the parameters
aws iam create-role --role-name mvcprogrammer-stats-auth --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": ["lambda.amazonaws.com", "edgelambda.amazonaws.com"] }, "Action": "sts:AssumeRole" }]
}'
aws iam attach-role-policy --role-name mvcprogrammer-stats-auth --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name mvcprogrammer-stats-auth --policy-name read-stats-parameters --policy-document '{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": ["ssm:GetParameters"], "Resource": "arn:aws:ssm:us-east-1:334383610383:parameter/mvcprogrammer/stats/*" }]
}'

# One time: the function (every later deploy is update-function-code + publish-version + a new association)
aws lambda create-function --region us-east-1 --function-name mvcprogrammer-stats-auth \
  --runtime nodejs22.x --handler index.handler --role arn:aws:iam::334383610383:role/mvcprogrammer-stats-auth \
  --timeout 5 --memory-size 128 --zip-file fileb://stats-auth.zip
aws lambda publish-version --region us-east-1 --function-name mvcprogrammer-stats-auth --query FunctionArn --output text
# Then set that versioned ARN as the viewer-request Lambda function association on the stats
# distribution's default behavior (docs/DEPLOY.md, "Visitor dashboard").
```

CloudWatch logs for an edge function appear in the region that served the request, in a log group
named `/aws/lambda/us-east-1.mvcprogrammer-stats-auth`.
