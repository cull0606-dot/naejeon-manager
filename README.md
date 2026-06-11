# ⚔️ 내전 매니저

리그 오브 레전드 내전 관리 플랫폼 — 선수 관리, 경매 시스템, 팀 관리, 통계

## 기능

- **선수 관리** — 선수 등록/수정/삭제, 티어/승률/등급(ACE·VALUE·NORMAL), 라인별 통계
- **경매 시스템** — 30초 타이머, 팀별 포인트 입찰, ALL IN, 낙찰/건너뛰기
- **팀 관리** — 팀별 선수 구성, 라인 커버리지, 강도 비교
- **통계** — 승률 TOP, 고티어 TOP, 등급 분포, 라인별 분포

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000 에서 확인
```

## Vercel 배포 (무료, 5분 완성)

### 1단계 — GitHub 업로드
1. [github.com](https://github.com) 에서 새 레포 생성 (예: `naejeon-manager`)
2. 이 폴더를 업로드:
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_ID/naejeon-manager.git
git push -u origin main
```

### 2단계 — Vercel 배포
1. [vercel.com](https://vercel.com) 접속 → GitHub 로그인
2. "Add New Project" → 방금 만든 레포 선택
3. Framework: **Next.js** (자동 감지됨)
4. "Deploy" 클릭

→ 약 1~2분 후 `https://naejeon-manager.vercel.app` 같은 URL로 접속 가능!

## 데이터 영속성 (선택사항)

현재는 메모리 기반 (새로고침 시 초기화). 영속 저장 원할 경우:
- **간단**: `localStorage` 연동 (같은 브라우저에서 유지)
- **다중 유저**: [Supabase](https://supabase.com) 무료 DB 연동 (실시간 공유 가능)

원하면 추가 구현 도와드릴게요!

## 기술 스택

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Context API (상태 관리)
