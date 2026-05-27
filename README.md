# 개꿀종목 v2

기존 데모를 버리고 새로 만든 프로젝트입니다. 처음부터 `DART 재무제표 수집 -> 파일 저장 -> 파싱 -> 지표 계산 -> 프론트 렌더링` 흐름을 기준으로 구성합니다.

## 핵심 구조

- `server/dart.ts`: DART 고유번호와 최근 5개년 사업보고서 주요 재무계정 수집
- `server/market.ts`: 공개 시세, 일봉, 이동평균/V25/RSI/MACD/볼린저/지지·저항 계산
- `server/storage.ts`: 로컬 파일 캐시 저장소
- `server/analysis.ts`: 성장성, 수익성, 효율성, 안정성, 기술지표 분석 결과 생성
- `src/main.tsx`: 분석 그래프와 지표 학습 라우트 렌더링
- `supabase/schema.sql`: DB 전환용 테이블 스키마
- `scripts/seed-supabase.mjs`: KOSPI/KOSDAQ 전체 종목, 최신 시세, 5개년 압축 재무지표 Supabase seed

## 저장 파일

런타임 데이터는 `data/cache/`에 저장되며 git에 올라가지 않습니다.

- DART 고유번호: `data/cache/dart/corp-codes.json`
- 종목별 재무제표: `data/cache/dart/fundamentals/<stockCode>-<year>.json`
- 종목별 일봉/기술지표: `data/cache/market/prices/<stockCode>.json`

## 분석 지표

- 펀더먼털: 매출 CAGR, 영업이익 CAGR, 순이익 CAGR, 영업이익률, 순이익률, ROE, ROI 근사, ROIC 근사, 부채비율, EBIT/EBITDA 근사
- 테크니컬: 5/20/60/120일 이동평균, V25, 거래량 강도, RSI 14, MACD, 볼린저 밴드, 20일 변동성, 20/60일 지지·저항
- 학습 라우트: `#/learn`에서 각 지표의 계산식, 쉬운 설명, 해석 방법, 주의점을 제공합니다.

## 실행

```bash
npm install
cp .env.example .env
npm run dev
```

`DART_API_KEY`를 `.env`에 넣으면 OpenDART 재무제표 수집이 활성화됩니다.

## Supabase seed 정책

무료 플랜 용량을 지키기 위해 Supabase에는 얇은 테이블만 저장합니다.

- `stocks`: 종목코드, 이름, 시장, DART corp code
- `latest_quotes`: 최신 가격, 등락률, 거래량, 랭킹
- `financial_metrics`: 5개년 사업보고서의 핵심 지표만 저장
- `analysis_cache`: 만료 시간이 있는 분석 결과 캐시

저장하지 않는 것:

- DART 원천 계정 전체 JSON
- 전종목 일봉 히스토리
- 뉴스/리포트 원문

일봉 히스토리는 사용자가 종목을 클릭할 때 lazy-load하고 로컬/edge cache에만 둡니다.

```bash
# Supabase SQL editor에서 supabase/schema.sql 적용 후 실행
npm run db:seed:kospi

# KOSPI+KOSDAQ 전체까지 확장
npm run db:seed:all

# 재무 선적재 없이 전체 최신 시세/종목만 갱신
npm run db:seed:quotes
```

필요 환경변수:

```bash
DART_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## 주의

MVP 검증용입니다. 상용 서비스에는 정식 시세 라이선스, 이용약관, 데이터 저장 정책, 투자 조언 면책 문구가 필요합니다.
