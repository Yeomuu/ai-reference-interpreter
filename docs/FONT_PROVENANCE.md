# Paperlogy 폰트 검증

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
