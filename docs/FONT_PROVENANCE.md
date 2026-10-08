# Paperlogy 폰트 검증

## 무손실 웹 컨테이너 최적화 · 2026-10-08 (최신)

사용자가 승인한 동일 폰트 배포를 유지하며, 제공 TTF를 무손실 WOFF 컨테이너로 추가한다. `sync-paperlogy-fonts.py --web`은 원본 SHA-256 확인 후 모든 OpenType 테이블을 대조한다(head checksum만 컨테이너 형식에 맞게 정규화). 글리프·메트릭·kerning·글꼴 이름과 원본 TTF는 변경하지 않는다. OFL 고지와 TTF fallback도 함께 배포한다.

5개 WOFF 합계 3,115,092bytes, 원본 TTF 합계 6,546,240bytes로 전송 자산 크기가 52.4% 줄었다. 브라우저 CDP의 실제 glyph-font 조회로 개발·로컬 production preview에서 Paperlogy Medium/Regular 및 Wanted Sans 사용을 확인했다. 최초 Vercel main 운영 배포에는 Paperlogy 파일 HTTP404가 있어 `.vercelignore`를 루트 source 폴더만 제외하고 public/fonts를 포함하도록 수정했다. 운영 파일 HTTP·해시·glyph 재검증 결과는 최신 QA 기록에 별도 표시한다. 변환·해시·테이블 대조 근거는 FONT_WEB_ASSETS_20261008.json과 최신 UI QA 기록이다. 아래 ‘변환하지 않는다’는 이전 기록이며 현재는 원본 파일을 보존한 컨테이너 변환만 허용한다.

## 동일한 개발·production 폰트 · 2026-10-08 (최신 사용자 지시)

사용자가 폰트 파일 배포 금지를 철회했다. 제공 Paperlogy 400/500/600/700/800을 public/fonts/paperlogy/로 원본 그대로 복사한다. scripts/sync-paperlogy-fonts.py는 기존 검증 SHA-256과 5개 파일을 모두 대조한 뒤 복사하며 변환·부분 추출·윤곽 변경·다운로드를 하지 않는다. 5개 총 6,546,240bytes이며 public/fonts/Paperlogy-OFL.txt 고지도 빌드에 포함된다. 경로·해시·크기: FONT_ASSETS_20261008.json. 원본 Paperlogy/는 보존한다.

public/fonts/fonts.css가 개발·production 공통 @font-face를 제공한다. src/main.tsx의 개발 전용 link는 제거했다. Wanted Sans Variable, 제공 MemomentKkukkukk 웹 파일과 Adobe 공식 키트 방식은 유지한다. Noto Sans KR은 기존 공식 Google Fonts 공급을 유지한다. 네트워크 기반 Adobe/Noto 공급까지 자체 파일로 바뀌었다고 주장하지 않는다.

진행은 Paperlogy Medium 18px·500, 사진 캡션 18px·400, 사진 순서는 기존 16px·500/800이다. 크기와 검증은 DESIGN_SYSTEM.md 및 QA_TYPOGRAPHY_NAVIGATION_20261008.md를 따른다.

## 실제 원본 역할별 로딩 · 2026-10-08 (이전 기록)

이전 Progress는 22px·500이고 사진 순서는 16px·500/800이었다. 당시 개발 전용 로딩으로 실제 400/500/800 loaded 상태를 확인했다. 개발 전용 및 production fallback 제한은 위 최신 사용자 지시로 폐기되었다.

사진/평면도 탭은 Noto Sans KR 20px·500이다. 공식 Google Fonts CSS `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;800&display=swap`을 index.html에서 읽고 500 loaded를 확인했다. 임의 font URL을 만들거나 폰트 바이너리를 내려받아 번들링하지 않는다. 근거: [공식 Noto Sans KR OFL](https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt). Wanted Sans/Adobe 공급 방식과 사용자 원본은 유지한다. 이전 단일 웹 UI font 해석은 최신 source-specific 역할에 한해 대체된다.

## 웹·Figma 최신 글꼴 · 2026-10-07 (아래 이전 UI 정책보다 우선)

사용자 지시에 따라 웹 UI는 작업 폴더에서 제공된 WantedSansVariable.woff2를 사용한다. public/fonts/wanted/OFL.txt에 공식 wanteddev/wanted-sans 저장소의 OFL 고지를 함께 둔다. https://github.com/wanteddev/wanted-sans/blob/main/OFL.txt . SHA-256: `4259e7e9a172e634c2cb419d793b84148990316341e910443e5d10965b2c8f16`.

브랜드 글꼴은 사용자가 제공한 공식 Adobe 키트 lbi1pvp, 실제 확인된 CSS family timeline-210이다. public/brand/adobe-fonts.js는 제공 embed를 사용하고 Adobe 글꼴 바이너리는 복제하지 않는다. 사이트/키트 권한은 제공 계정의 설정을 따른다. Chrome에서 Wanted Sans와 timeline-210 실제 load 상태를 확인했다.

사용자 제공 memomentKkukkkuk.otf의 내부 family는 MemomentKkukkukk, SHA-256 `c22eb6e981ec0f5a194834ac3e2c418c1c8840acd217e91c8faa5567224fe2a5`다. 사용자가 지정한 임시 fallback이며 무료 배포 라이선스로 검증했다고 주장하지 않는다. 원본 로컬 폴더 중복은 커밋하지 않는다. 웹용은 전체 glyph·CFF 윤곽·family가 동일함을 검증한 WOFF2로 변환했다(26,221,216 → 5,586,904bytes). 원본 사용자 OTF는 그대로 유지하며 웹 폰트 SHA-256은 `d29b277a5ed74160a97262acd253c2de13c0ce44ebb406c04fa8a47d41a2b867`다.

Figma 도구에서 위 글꼴을 사용할 수 없어 사용자의 최신 승인대로 Noto Sans KR 기본 글꼴로 편집했다. 워드마크 원본 윤곽은 네이티브 벡터로 보존한다. PDF 가이드의 합법적으로 검증된 기존 로컬 Paperlogy는 계속 사용하며 별도 폰트 파일을 가이드에 배포하지 않는다.

작업 폴더의 `Paperlogy/` TTF 9종을 제작자 [Freesentation 공식 저장소의 v1.001 압축 파일](https://github.com/Freesentation/paperlogy/blob/main/Paperlogy-1.001.zip)에 들어 있는 동명 파일과 SHA-256으로 대조했습니다. 2026-09-24 확인 시 9종 모두 바이트 단위로 일치했습니다. 검증에 사용한 압축 파일은 작업 폴더에서 제거했습니다.

| 파일 | SHA-256 |
|---|---|
| `Paperlogy-1Thin.ttf` | `9D8F4627B1A299DFEDC7382C14F56521913BA6FA667753CCD6FBCC4E38824A8A` |
| `Paperlogy-2ExtraLight.ttf` | `E7EE3FDE6D3AC91CCA98F2EEB3D39EE87984AA06A0C442C6B2F900255C453593` |
| `Paperlogy-3Light.ttf` | `7E92CD3075E088E4FD139DA64E7A46F3102B8B8797EEE5C1CCFC37B13A5A7794` |
| `Paperlogy-4Regular.ttf` | `05E1021E3DE620DDDC97875342E2BE1A94C5F8E9B9F792BD16C4C1D0085343B3` |
| `Paperlogy-5Medium.ttf` | `F3C97ACE885BB7D2A53A73DC71D832FA79988D5F546C2562ABBB87AA07492F4B` |
| `Paperlogy-6SemiBold.ttf` | `CA92034A1C4602A57C55434DFDBF8428A0BB88AC84A99A5EFFEC1A41F0118127` |
| `Paperlogy-7Bold.ttf` | `7EFFB892621474E9C2A9112F482EB87DD25B65A470E5AE5971BE5A68D89AD89B` |
| `Paperlogy-8ExtraBold.ttf` | `FB0324F8AC057E50F4F4632331617E347BFE5A04184F7B0DB514BE682FB6B25C` |
| `Paperlogy-9Black.ttf` | `9A2149095D72AE268ABB3ACF6A3A6AB4ADCAE8C0EBB98999BD2D607F22149BC0` |

화면에는 400, 500, 600, 700, 800 굵기를 포함합니다. 제작자 [공식 안내](https://freesentation.blog/paperlogyfont)는 Paperlogy v1.001을 SIL OFL로 배포합니다. 제작자 저장소의 [라이선스 전문](https://github.com/Freesentation/paperlogy/blob/main/OFL%20license.txt)을 `public/fonts/Paperlogy-OFL.txt`에 포함했습니다.

개발과 배포는 모두 public/fonts/의 같은 제공 폰트를 읽습니다. 원본 `Paperlogy/`는 버전 관리에서 제외하지만 검증된 배포 사본은 public/fonts/paperlogy/에 포함합니다. 소유자는 최신 사용자 지시에서 이를 명시적으로 승인했습니다.
