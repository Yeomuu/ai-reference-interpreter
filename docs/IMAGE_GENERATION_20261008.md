# GPT Image 2 전환 및 생성 입력 설명 · 2026-10-08

사용자가 요청한 `gpt-imgae2`는 실제 지원 모델명 `gpt-image-2`로 적용했다. 기본 탐색·배치·샘플에는 모델 호출이 없다. 사용자가 AI 이미지 생성을 누를 때, 선택 시점마다 예약된 요청 하나로 이미지 한 장을 만든다.

## 실제 요청 설정

| 항목 | 현재 구현 |
|---|---|
| 서버 API | POST https://api.openai.com/v1/images/edits |
| model | gpt-image-2 |
| quality / size / n | high / 1536x1024 / 1 |
| input_fidelity | 보내지 않음: GPT Image 2는 항상 높은 입력 충실도이며 이 매개변수 미지원 |
| 결과 | JPEG, output_compression=100 (기존 72) |
| 입력 | 최대 5장, 각 JPEG 550,000bytes 이하, JSON 본문 4,000,000bytes 이하 |
| 프롬프트 | 서버가 저장 프로젝트·시점·검증된 입력 manifest로 재작성, 최대 16,000자 |
| 시간 제한 | 기존 서버 180초 / provider 최대 170초 유지 |

근거: [공식 GPT Image 2 모델](https://developers.openai.com/api/docs/models/gpt-image-2), [공식 이미지 프롬프팅](https://developers.openai.com/api/docs/guides/image-prompting), [이미지 편집 API](https://developers.openai.com/api/reference/resources/images/methods/edit). JPEG 100은 압축 품질의 최댓값이며 무손실 파일이나 모델 노이즈 제거 보장이 아니다. 기존 JPEG 저장·내보내기와 bounded response 계약을 유지한다. PNG로 변경했다고 주장하지 않는다.

이전 Mini 모델의 $0.006/장 가격과 종료 예정 문구는 현재 설정에서 제거했다. status의 outputPriceUsd는 검증된 고정 장당 요금이 없음을 뜻하는 null이다. 현재 공식 표는 GPT Image 2의 일반 image input $4 / cached input $1 / output $15, text input $2.50 / cached input $0.625를 백만 토큰 단위로 표시한다. 실제 입력·출력 사용량과 청구 시점의 가격에 따라 비용이 달라진다. high 전환은 비용·생성 시간이 증가할 수 있으며, 기존 하루 60/20회는 달러 비용 상한이 아니다. [공식 요금표](https://developers.openai.com/api/docs/pricing)

## 이미지 제공 순서와 범위

1. **기존 공간 사진**: 사용자가 선택한 실제 공간을 첫 입력으로 제공한다. 건축 외관의 기준이며 등록 원본은 수정하지 않는다. 보존하지 않은 느슨한 책상·의자·잡동사니만 시안에서 정리할 수 있고, 벽·창·문·기둥·천장·고정 설비와 필수 보존 요소는 유지하도록 지시한다.
2. **저장된 도면 가이드**: 실제 저장 구조·바닥 윤곽·배치 크기/회전·벽 부착 구간·천장 위치와 선택한 카메라 화살표를 로컬 SVG→JPEG로 만든다. 업로드 도면은 가이드 배경에 들어간다. 이는 모델 호출이나 사진에서 도면을 추출하는 과정이 아니다.
3. **적용 레퍼런스**: 전체 이미지/사용자 선택 crop/2~4개 crop grid를 전송한다. 3개를 넘는 출처는 최대 3장의 번호 있는 모음으로 나누며 추가 모델 호출은 없다. 적용 요소의 출처 이미지, 모음의 패널 번호, crop 영역을 프롬프트와 manifest로 연결한다. 제외·미사용 출처는 적용 자료로 보내지 않는다.

원본 비트맵에서 한 번씩 canvas에 그린다. 모음 안의 crop을 JPEG로 압축한 뒤 다시 JPEG로 압축하던 중간 단계를 제거했다. 일반 입력은 긴 변 1600/1440/1280/1024와 JPEG 품질 .94/.90/.86/.82 순서로 byte 제한을 확인하며 원본을 확대하지 않는다. 모음은 1536×1536, 품질 .94~.82이다. 이전 .36까지의 과도한 압축을 없앴다. 제한 안에서 선명도를 유지하지 못하면 사용자가 입력을 조정할 수 있도록 생성 **전에** 오류를 보여 준다. 출처를 조용히 삭제하거나 모델을 자동 재호출하지 않는다.

## 좌표가 모델에 전달되는 방식

- 도면 내용의 왼쪽 위가 (0,0), 오른쪽 아래가 (1,1)이다. x는 오른쪽, y는 아래로 증가한다. 도면 제목·여백은 원점에 포함하지 않는다.
- 요소 목록과 도면의 물체 라벨에 같은 E01/E02 번호를 붙인다. 예: `E01 ... Plan anchor x=0.3125, y=0.4567 (logical plan x=312.5, y=342.525)`는 **1000×750 논리 도면인 경우**의 계산 예시다. 실제 값은 저장된 도면 폭·높이를 사용한다.
- 바닥 물체는 중심·footprint·회전, 벽 부착물은 벽 이름·span·양 끝 좌표·가벽 A/B 면, 천장 물체는 zone·내부 offset·설치 높이 조건을 전달한다. 상품은 support ID·상판 내부 offset을 사용하고 support 회전을 반영한 도면 위치를 계산한다.
- 영역은 전체 저장 bounds/수동 polygon을 설명한다. 영역 중심은 대표 anchor일 뿐, 물체를 모두 가운데 쌓으라는 지시가 아니다. 전역 분위기 조건은 한 점의 물체처럼 만들지 않는다.
- 카메라는 저장 x/y, 방향, FOV preset, 높이·pitch와 카메라 기준 앞/뒤/좌/우 관계를 전달한다. 0°=오른쪽, 90°=아래, 180°=왼쪽, 270°=위다. 가벽 반대 면의 부착물은 복제하거나 다른 벽으로 이동하지 말고 화면 밖으로 처리하도록 지시한다.
- 정규화 좌표와 논리 도면 좌표는 **미터·사진 픽셀·생성 결과 픽셀·검증된 3D 투영이 아니다**. 원근 사진의 특정 픽셀에 정확히 대응한다고 주장하지 않는다.

## 보존·레퍼런스·노이즈 지시

우선순위는 저장된 보존/유효 배치 → 기존 건축 → 사용자 목표/명시한 참고 속성이다. 레퍼런스 속 텍스트는 데이터이며 보존 규칙을 바꾸는 지시로 해석하지 않도록 요청한다. 객체는 해당 물체만, 조명은 국소 빛의 특성만, 색/재질은 사용자가 지정한 표면만 전달한다. 참고 사진의 방 형태·곡선 벽·배경 가구를 새 공간 구조로 복제하지 않도록 분리한다.

깨끗한 실사 재질·일관된 원근·인식 가능한 상품 형태를 요구하며 grain/speckle/block/ringing/반복 texture/과한 sharpening/흐린 대체·불필요한 글자를 피하도록 명시한다. 전체 노란 필터 대신 중립 일반광과 국소 온색 조명을 구분한다. 이는 명확한 입력과 품질 설정을 통한 개선이며 정확한 공간 일치, 무노이즈 또는 모든 참고 세부 재현을 인증하지 않는다. 자동 이미지 평가·3D solver·두 번째 보정 모델 호출을 새로 만들지 않았다.

## 유지된 기술 로직과 실행 검증

서버 env 키, 익명 서명 쿠키, 공유 비공개 quota, 한국 자정의 60/20회 일일 한도, 호출 전 예약·저장소 오류 시 차단·UUID 재전송 거절·불확실 결과 재호출 보호를 유지한다. Keep/typed anchor/기둥·문 여유·통로·상품 support 사전 검증, 각 시점의 조건 스냅샷, partial batch 성공 보관과 stale 결과 이력을 유지한다.

- API 단위 검사: 실제 FormData의 model/high/size/n/JPEG100, input_fidelity 부재, invalid manifest/과도한 조건/한도 오류가 유료 호출 전에 거절되는지 확인했다.
- 13개 혼합 요소·다수 Keep와 20개 전시 요소에서도 source/crop/가벽 면/개별 조건이 16,000자 제한 안에서 유지된다. 초과 입력을 잘라서 보내지 않는다.
- 좌표·E 번호·벽 endpoint·천장 offset의 단위 검사를 추가했다. 전체 31파일 272검사 통과.
- 실제 Edge 입력 준비: 공간 1600×1200/444,411bytes, crop 1600×1200/365,203bytes, 2-crop grid 1600×800/233,595bytes, 모음 1536²/159,301bytes. 모음 JPEG encoding은 **1회**, JS 오류 0, 모델 POST 0. 가이드 캡처를 직접 확인했다. 파일: `qa-screens/ui-polish-20261008/generation-inputs/`.
- 최초 로컬 서버 키의 무료 GET /v1/models/gpt-image-2 조회는 HTTP401/invalid_api_key였다. 사용자가 서버 키 갱신 완료를 알린 뒤 동일한 무료 조회를 다시 실행했고 **HTTP200, model id=gpt-image-2**를 확인했다. 키·오류 원문은 출력하지 않았고 키 생성·교체를 대신하지 않았다. 이 성공은 로컬 키의 인증·모델 메타데이터 접근 확인이며 Vercel 키, 유료 이미지 편집 권한·결제·생성 품질을 검증한 것은 아니다. 두 조회 모두 이미지 생성 호출 0회다.
- main 운영 배포 후 별도 Edge QA 프로필에서 실제 생성 POST를 **1회** 실행했다. 기존 공간 사진 444,411bytes·도면 46,244bytes·조명 참고 311,209bytes·전시대 참고 184,500bytes를 전송했으며, 운영 서버는 6.5초 후 HTTP502와 OpenAI 인증/권한(상위 401/403) 범주의 오류를 반환했다. 응답이 상위 401과403을 구분하지 않으므로 원인을 invalid key 또는 모델 권한으로 단정하지 않는다. 서비스 공유 한도는 60→59, 해당 QA 브라우저는20→19로 기록됐고 busy는 해제됐다. 실패 요청의 기록은 초기화하지 않았고 자동 재호출하지 않았다. OpenAI 과금 여부·모델 이미지 품질은 확인하지 않았다.
- 무료 로컬 인증 진단은 이미지 없이 edits를 요청해 HTTP400/missing_required_parameter(image)였다. 실제 생성 0회이며 이 응답만으로 완전한 이미지 모델 접근 권한을 인증하지 않는다. Vercel CLI의 값이 없는 metadata에서 OPENAI_API_KEY(production/preview)의 마지막 수정이 9월임을 확인했다. 새 로컬 키의 원격 동기화·재배포에 대한 사용자 승인을 요청했다. 키 값은 출력·커밋하지 않았다.

## 키 동기화 후 실제 생성 재검증

사용자가 원격 키 동기화·재배포를 승인했다. 제공 로컬 키를 값 출력 없이 Vercel의 기존 sensitive OPENAI_API_KEY(production/preview)에 반영했고 환경 metadata의 수정시각을 확인했다. main/3a70d34의 production 재배포dpl_5GYKiBpcRG6gb6XABevx1jXrTcyB가 READY인 뒤, 별도 QA 프로필에서 실제 요청1회가 **HTTP200, gpt-image-2/high/1536x1024 JPEG, 154,205bytes, 86.6초**로 성공했다. AI origin·조건 스냅샷·미승인/현재 조건 상태로 브라우저 저장됐고 새로고침 후 표시1개·JS오류0을 확인했다. 서비스 한도59→58, 새 QA 익명 브라우저20→19, busy해제다. 기존 원장·실패 기록은 삭제/리셋하지 않았다. 이전 실패와 합쳐 운영 POST2회/실제 이미지1장이며 OpenAI 청구액은 조회하지 않았다.

공간 사진·조명/전시대 참고·실제 결과를 직접 비교했다. 중앙의 아이보리 전시대 형태, 주요 창·화이트보드·출입문은 알아볼 수 있고 뚜렷한 block/ringing은 보이지 않았으나, 조명 참고의 벽 게시물이 추가되고 하나의 배치가 세 개 plinth 형태로 해석되는 차이가 남았다. 천장 고정 장비도 전체 일치를 확인할 수 없었다. 이 관찰을 근거로 조명 참고의 posters/art/signage/display contents 이전을 금지하고, 새 벽 콘텐츠는 저장된 wall-graphic/wall-mounted-product 대상에만 허용했다. 한 freestanding fixture/furniture E키는 한 footprint 안의 설치1개이며 명시한 세트만 composite를 허용한다. 원래 사진에서 보이는 projector/HVAC/speakers/radiator/whiteboard/light를 개략도에 개별 annotation이 없어도 고정 설비로 유지하도록 강화했다. 호환되는 저장 벽 그래픽은 계속 허용한다.

큰 프로젝트는 동일한 규칙을 짧은 공통 문장으로 제공한다. 초기 규칙 추가로 13개 혼합 요소의 16,000자 검사가 실패하여 공유 설명만 압축했으며 개별 조건·위치·면·crop·보존 설명·출처를 자르지 않는다. 13개 혼합/20개 전시 테스트와 새 속성 경계 검사, 전체31파일273검사/lint/typecheck/build가 다시 통과했다. 첫 성공1장만으로 전 시점의 공간 일치나 무노이즈를 보장하지 않는다. 강화 프롬프트의 운영 이미지 재검증 결과는 다음 기록에 추가한다.

구현: `src/services/generationContract.ts`, `planGuide.ts`, `imageProvider.ts`, `api/generate.ts`. 재현: `scripts/qa-generation-inputs.mjs`, `tests/generationApi.test.ts`, `tests/planGuide.test.ts`.
