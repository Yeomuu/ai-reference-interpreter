# Paperlogy 폰트 검증

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

화면에는 400, 500, 600, 700 굵기만 포함합니다. 제작자 [공식 안내](https://freesentation.blog/paperlogyfont)는 Paperlogy v1.001을 SIL OFL로 배포합니다. 제작자 저장소의 [라이선스 전문](https://github.com/Freesentation/paperlogy/blob/main/OFL%20license.txt)을 `public/fonts/Paperlogy-OFL.txt`에 포함했습니다.

개발 화면은 사용자 작업 폴더의 `Paperlogy/`를 루트 경로에서 읽습니다. `dev/local-paperlogy.css`는 개발 서버에서만 불러오므로 프로덕션 빌드가 TTF를 복사하거나 없는 폰트를 요청하지 않습니다. `Paperlogy/`는 버전 관리에서 제외합니다. 배포 화면은 문서화된 `Noto Sans KR`, 시스템 산세리프 순으로 대체됩니다. 폰트 파일을 포함하는 별도 배포는 라이선스 고지와 함께 소유자가 결정해야 합니다.
