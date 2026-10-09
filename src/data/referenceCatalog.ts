export type ReferenceCategory = 'wall' | 'chair' | 'lighting' | 'display';
export interface CatalogReference {
  id: string; category: ReferenceCategory; name: string; uri: string;
  width: number; height: number; previewUri?: string; description: string; credit: string; sourceUrl?: string;
}
export const REFERENCE_CATEGORIES = {all:'전체',wall:'벽면',chair:'의자',lighting:'조명',display:'전시대'} as const;
// Prepared material only: no placement, mapping or model call is implied.
export const REFERENCE_CATALOG: readonly CatalogReference[] = [
  {id:'wall-curves',previewUri:'/sample/library/wall-curves-preview.webp',category:'wall',name:'탈착식 곡선 벽면 그래픽',uri:'/sample/graphic.png',width:1536,height:1024,description:'곡선 패널의 형태와 중립색 소재를 참고하세요.',credit:'기획 참고 · 생성 이미지'},
  {id:'cane-chair',category:'chair',name:'곡목·라탄 의자',uri:'/sample/library/chair.webp',width:960,height:1440,description:'등받이 곡선과 라탄 좌판을 참고하세요. 사진의 배경은 가져오지 않습니다.',credit:'사진 · Antonio Borrillo · CC0',sourceUrl:'https://commons.wikimedia.org/wiki/File:Chair.JPG'},
  {id:'floor-lamp',category:'lighting',name:'방향을 조절하는 스탠드 조명',uri:'/sample/library/floor-light.webp',width:1440,height:964,description:'조명 헤드와 지지대 형태를 참고하세요. 사진의 벽 색은 가져오지 않습니다.',credit:'사진 · David van Dijk · CC0',sourceUrl:'https://commons.wikimedia.org/wiki/File:Floor_lamp_near_a_wall_(Unsplash).jpg'},
  {id:'warm-light',previewUri:'/sample/library/warm-light-preview.webp',category:'lighting',name:'따뜻한 간접 조명 분위기',uri:'/sample/atmosphere.png',width:1536,height:1024,description:'빛의 색과 퍼지는 방식을 참고하세요. 공간 구조는 가져오지 않습니다.',credit:'기획 참고 · 생성 이미지'},
  {id:'exhibition-display',previewUri:'/sample/library/exhibition-display-preview.webp',category:'display',name:'졸업작품 전시대',uri:'/sample/campus/exhibition-display.png',width:1448,height:1086,description:'작품을 올리는 전시 가구의 형태를 참고하세요.',credit:'기획 참고 · 생성 이미지'},
  {id:'curved-display',previewUri:'/sample/library/curved-display-preview.webp',category:'display',name:'낮은 곡선형 진열대',uri:'/sample/product.png',width:1536,height:1024,description:'낮은 곡선 진열대의 형태와 소재를 참고하세요.',credit:'기획 참고 · 생성 이미지'},
];
