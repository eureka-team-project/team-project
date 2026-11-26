# 인프라 정책 (필수 준수)

이 팀 서비스의 **호스팅·백엔드·데이터베이스·파일 저장은 반드시 AWS만 사용**한다.
다른 클라우드/서드파티 호스팅(Vercel, Netlify, Firebase, Supabase, Cloudflare,
Heroku, Render, Railway, MongoDB Atlas 등)은 제안하거나 도입하지 않는다.

## 영역별 사용 서비스 (AWS 범위 내에서 선택)

- **프론트엔드 호스팅**: S3 정적 호스팅 + CloudFront (또는 AWS Amplify Hosting)
- **백엔드/API**: API Gateway + Lambda (현재 사용 중),
  필요 시 ECS/Fargate, App Runner, EC2 등 AWS 컴퓨팅
- **데이터베이스**: DynamoDB, RDS, Aurora 등 AWS 관리형 DB
- **파일 저장**: S3
- **인증**: 필요 시 Amazon Cognito
- **도메인/DNS/인증서**: Route 53 + ACM

## 현재 구성 (참고)

- 백엔드 API 베이스:
  `https://n64kgto9e6.execute-api.ap-southeast-2.amazonaws.com`
  → AWS API Gateway (리전: ap-southeast-2 / 시드니)
- 프론트엔드: React + Vite (`src/App.jsx`)

## 에이전트 지침

- 새 기능에 저장소/서버/파일저장이 필요하면 **AWS 서비스로만** 설계·제안한다.
- 코드 예시, 배포 가이드, 환경변수, IaC(CloudFormation/CDK/Terraform) 모두
  AWS 리소스를 전제로 작성한다.
- 리전은 특별한 사유가 없으면 기존과 동일하게 **ap-southeast-2**를 기본값으로 쓴다.
- 비(非)AWS 서비스가 더 쉬워 보이더라도 대안으로 제시하지 않는다.
  제약을 바꿔야 할 상황이면 먼저 사용자에게 확인한다.
