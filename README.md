# 공간 레퍼런스 해석기

기존 공간 사진과 평면도를 기준으로 Keep 보존 조건, 레퍼런스, 유형별 배치, 카메라 시점, 결과 검토를 관리하는 데스크톱 중심 웹 서비스입니다. 화면은 한국어로 제공됩니다.

## 실행

```bash
npm install
npm run dev
```

개발 서버 주소는 Vite 출력에 표시됩니다. 품질 검사는 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`로 실행합니다.

## 현재 동작

- 새 프로젝트 작성 또는 AURA POP-UP 샘플 열기
- 기존 공간 사진, 분위기·요소 레퍼런스, 제품 사진을 서로 다른 역할로 등록
- 평면도 이미지 등록 또는 치수 미확인 개략 도면 작성, 구조와 영역 표시
- 업로드한 평면도에는 사용 바닥을 직접 표시해야 하며, 도면 교체 뒤에는 기존 구조·배치 대응을 확인하기 전 미리보기를 차단
- 기존 기본 구조의 필수 Keep, 추가 가벽의 선택형 Keep 및 충돌 검증, 탈착식 벽면 연출 허용 조건 설정
- 평면도 레이어에서 바닥 요소·벽 구간·가벽·카메라를 직접 이동하고 적용 가능한 각도를 손잡이로 조정
- 요소 유형에 따라 바닥·벽·천장·공간 영역만 선택, 기둥·문·동선·개구부 충돌 검증
- 대표 카메라와 최대 두 개의 추가 시점 설정
- 조건 검토, 오래된 결과 표시, 개별 수정, 결과 승인, 승인 결과 모아보기
- 이미지 다운로드 및 조건 JSON 기록 다운로드

프로젝트 JSON은 브라우저 `localStorage`에 버전과 함께 보관하고, 업로드 이미지 원본은 `IndexedDB`에 저장합니다. JSON 기록 파일에는 업로드 이미지 원본이 포함되지 않으므로 다른 브라우저로 완전 복원하는 형식은 아직 아닙니다.

## 이미지 생성과 샘플의 경계

`public/sample/result.png`는 미리 준비된 AURA POP-UP 예시이며 현재 배치나 추가 카메라 설정을 반영하지 않습니다. 앱은 이를 무료 샘플로 표시합니다. [제작 경위](docs/DEMO_ASSETS.md)도 기록했습니다.

Vercel 서버에 `OPENAI_API_KEY`와 `GENERATION_ACCESS_CODE`를 설정하면 조건 검토 단계에 실제 OpenAI 이미지 생성 버튼이 열립니다. 사용자가 그 버튼을 누를 때만 선택 시점의 저화질 이미지 1장을 요청합니다. 샘플 버튼은 별도로 유지됩니다. API 키는 서버 함수에서만 읽고, 접근 코드는 프로젝트나 브라우저 저장소에 저장하지 않습니다. 모델 출력은 구조·치수·Keep 준수를 보장하지 않으므로 사용자가 결과를 검토해야 합니다. 키가 없거나 생성에 실패해도 기존 결과와 샘플은 사용할 수 있습니다. 사용 모델의 공식 출력 요금 예시는 US$0.006/장이며 입력 이미지·문장 비용이 더해집니다. **`gpt-image-1-mini`는 2026-12-01에 종료 예정**이라 그 전에 모델을 교체해야 합니다. 자세한 경계와 공식 근거는 [API 연결 문서](docs/API_INTEGRATION.md)를 보세요.

일반 `npm run dev`는 Vite 화면만 띄우므로 Vercel 서버 함수를 실행하지 않습니다. 배포 환경이나 호환 로컬 함수 실행기에서 `/api/status`와 `/api/generate`를 확인하세요. 유료 OpenAI 호출은 자동으로 실행하지 않습니다. 서버 비밀값을 `.env.local` 또는 Vercel 환경 변수에만 두고 저장소에는 올리지 마세요. `GENERATION_ACCESS_CODE`가 없는 공개 배포에서는 실제 생성이 비활성화됩니다.

Paperlogy v1.001 TTF는 [제작자 공식 배포본](https://github.com/Freesentation/paperlogy)과 SHA-256이 일치하는 사용자 제공 파일을 로컬 개발 화면에서만 사용합니다. 프로덕션 빌드와 저장소에는 TTF를 포함하지 않고 `Noto Sans KR`, 시스템 sans-serif로 대체합니다. [라이선스](public/fonts/Paperlogy-OFL.txt)와 [검증 기록](docs/FONT_PROVENANCE.md)을 참조하세요. 조작 아이콘은 출처와 라이선스를 확인한 공식 무료 Nucleo UI Essential Outline SVG만 사용하며, [아이콘 목록](docs/ICON_MANIFEST.md)에 파일별 출처와 용도를 기록했습니다.

헤더 로고와 파비콘에는 같은 자체 제작 SVG 브랜드 마크인 [public/brand/mark.svg](public/brand/mark.svg)를 사용합니다. 이 브랜드 마크는 UI 조작 아이콘 세트와 별개입니다.

기능과 디자인 계약은 [docs/PRODUCT.md](docs/PRODUCT.md), [docs/INTERACTIONS.md](docs/INTERACTIONS.md), [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), [docs/QA.md](docs/QA.md)를 참조하세요.

1차 기술 QA의 수정 내역과 남은 범위는 [docs/QA_FIRST_PASS.md](docs/QA_FIRST_PASS.md)에 기록했습니다.

캔버스 조작, 필수 보존 구조, 결과 탐색과 알림에 관한 후속 사양 변경 이유는 [docs/UX_SPEC_CHANGELOG.md](docs/UX_SPEC_CHANGELOG.md)에 기록했습니다.

후속 구현과 브라우저 검증 결과는 [docs/QA_SECOND_PASS.md](docs/QA_SECOND_PASS.md)에 기록했습니다.
