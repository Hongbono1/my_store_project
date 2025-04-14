# Node.js LTS 버전 사용
FROM node:18

# 작업 디렉토리 생성
WORKDIR /app

# 의존성 설치용 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 🔥 프로젝트 전체 복사 (public, uploads 등 포함)
COPY . .

# uploads 폴더가 없으면 생성
RUN mkdir -p uploads

# .env 파일은 로컬에서는 사용하지만, Cloudtype에서는 환경변수로 관리됨

# 3000번 포트 노출
EXPOSE 3000

# 서버 실행
CMD ["node", "server.js"]
