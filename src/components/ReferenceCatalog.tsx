import { useRef, useState } from 'react';
import type { Project } from '../domain/types';
import { REFERENCE_CATALOG, REFERENCE_CATEGORIES, type ReferenceCategory } from '../data/referenceCatalog';
import { countReferenceImages } from '../domain/prototypeLimits';
import { MAX_REFERENCE_IMAGES } from '../domain/prototypeConfig';
import AssetImage from './AssetImage';
import NucleoIcon from './NucleoIcon';

export default function ReferenceCatalog({project,busy,onChoose}:{project:Project;busy:boolean;onChoose:(id:string)=>boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [category,setCategory]=useState<ReferenceCategory|'all'>('all');
  const limit=countReferenceImages(project)>=MAX_REFERENCE_IMAGES;
  return <>
    <button type="button" className="button reference-catalog-open" onClick={()=>dialog.current?.showModal()}><NucleoIcon name="images"/>기본 레퍼런스에서 고르기</button>
    <dialog ref={dialog} className="reference-library reference-catalog-dialog" aria-labelledby="reference-catalog-title">
      <div className="group-heading"><h2 id="reference-catalog-title">기본 레퍼런스</h2><button type="button" className="button button-quiet" aria-label="기본 레퍼런스 닫기" onClick={()=>dialog.current?.close()}><NucleoIcon name="close"/></button></div>
      <p className="muted">벽면·의자·조명·전시대 자료를 준비했습니다. 등록한 뒤 도면에서 적용할 요소와 가져올 내용을 선택하세요.</p>
      <div className="reference-catalog-categories" aria-label="기본 레퍼런스 분류">{Object.entries(REFERENCE_CATEGORIES).map(([id,label])=><button type="button" className="button" key={id} aria-pressed={category===id} onClick={()=>setCategory(id as typeof category)}>{label}</button>)}</div>
      <div className="reference-catalog-grid">{REFERENCE_CATALOG.filter(item=>category==='all'||item.category===category).map(entry=>{
        const registered=project.references.some(ref=>project.sourceImages.some(image=>image.id===ref.imageId&&image.uri===entry.uri));
        return <article key={entry.id} className="reference-catalog-item">
          <AssetImage uri={entry.previewUri??entry.uri} alt={entry.name}/><h3>{entry.name}</h3><p>{entry.description}</p>
          <p className="muted small">{entry.credit}{entry.sourceUrl&&<> · <a href={entry.sourceUrl} target="_blank" rel="noreferrer">출처 보기</a></>}</p>
          <button type="button" className="button" disabled={busy||(!registered&&limit)} onClick={()=>{if(onChoose(entry.id))dialog.current?.close();}}>{registered?'등록한 이미지 선택':limit?'등록 한도에 도달했습니다':'이 이미지 등록'}</button>
        </article>;
      })}</div>
      <p className="muted small">기획 참고 이미지는 미리 준비한 생성 자료이며 실제 공간 사진이나 현재 프로젝트의 시안이 아닙니다.</p>
    </dialog>
  </>;
}
