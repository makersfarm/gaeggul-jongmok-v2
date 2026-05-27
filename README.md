# 개꿀종목 v2

기존 데모를 버리고 새로 만든 프로젝트입니다. 처음부터 `DART 재무제표 수집 -> 파일 저장 -> 파싱 -> 지표 계산 -> 프론트 렌더링` 흐름을 기준으로 구성합니다.

## 핵심 구조

- `server/dart.ts`: DART 고유번호, 공시, 사업보고서 주요 재무계정 수집
- `server/market.ts`: 공개 시세, 일봉, 이동평균/V25/지지·저항 계산
- `server/storage.ts`: 로컬 파일 캐시 저장소
- `server/analysis.ts`: 펀더먼털/테크니컬 분석 결과 생성
- `src/main.tsx`: 분석 결과 렌더링
- `supabase/schema.sql`: DB 전환용 테이블 스키마

## 저장 파일

런타임 데이터는 `data/cache/`에 저장되며 git에 올라가지 않습니다.

- DART 고유번호: `data/cache/dart/corp-codes.json`
- 종목별 재무제표: `data/cache/dart/fundamentals/<stockCode>-<year>.json`
- 종목별 일봉/기술지표: `data/cache/market/prices/<stockCode>.json`

## 실행

```bash
npm install
cp .env.example .env
npm run dev
```

`DART_API_KEY`를 `.env`에 넣으면 OpenDART 재무제표 수집이 활성화됩니다.

## 주의

MVP 검증용입니다. 상용 서비스에는 정식 시세 라이선스, 이용약관, 데이터 저장 정책, 투자 조언 면책 문구가 필요합니다.
