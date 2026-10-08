# 사용자 디자인 보존 · 2026-10-08

- 사용자 제작 홈/STEP 01 원본을 시각적으로 재설계하지 않는다. 실제 노드의 폰트 크기·문구·간격·각 요소별 R값과 SVG·hover 컴포넌트를 대응시킨다.
- SVG는 node-only SVG_STRING export를 쓰고 주변 프레임/배경이 없는지 검사한다. Corner/Center Marker를 누락하지 않는다.
- STEP 02는 3열 편집 툴, STEP 03은 2열. STEP 02~04 외곽은 STEP 01과 같은 R8/약한 그림자. R0로 바꾸지 않는다.
- 학교 STEP 01은 내부 scrollbar 없이 목표가 fill/max188, Next는 우측 하단. 좁고 짧은 창에서도 임의 폰트 축소 없이 조절한다.
- 홈 기본값은 편집 가능. 원본 부유는 유지하고 포인터 parallax만 매우 작게 한다.
- 원본 DESIGN.md는 변경하지 않는다. Figma 대체 글꼴은 승인된 Noto Sans KR, 웹은 사용자 제공 Wanted Sans/Adobe 키트다.
