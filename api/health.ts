export default function handler(req: any, res: any) {
  const s3Configured = Boolean(process.env.S3_BUCKET_ARN || process.env.S3_BUCKET_NAME);
  const awsConfigured = Boolean(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION);
  const cognitoConfigured = Boolean(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_REGION);
  const adminGroup = process.env.COGNITO_ADMIN_GROUP || '(non défini → défaut: admins)';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: true,
    env: {
      s3: s3Configured,
      aws: awsConfigured,
      cognito: cognitoConfigured,
      adminGroup,
    },
  }));
}
