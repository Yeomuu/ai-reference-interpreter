import { useEffect, useId, useState } from 'react';
import type { FormEvent, MouseEvent, SyntheticEvent } from 'react';
import type { Keep, Point, Structure } from '../domain/types';
import { resolveImageUri, revokeImageUrl } from '../services/assets';
import NucleoIcon from './NucleoIcon';
import './photo-keep-overlay.css';

export interface PhotoKeepOverlayProps {
  imageUri: string;
  structures: Structure[];
  keeps: Keep[];
  selectedStructureId?: string;
  onSelect: (id: string) => void;
  onSetAnchor: (id: string, point: Point) => void;
}

function isValidAnchor(point: Point | undefined): point is Point {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function clampFraction(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Photo annotations are approximate and independent from plan placement coordinates. */
export default function PhotoKeepOverlay({
  imageUri,
  structures,
  keeps,
  selectedStructureId,
  onSelect,
  onSetAnchor,
}: PhotoKeepOverlayProps) {
  const instructionId = useId();
  const [image, setImage] = useState<{ uri: string; src?: string; error?: string } | null>(null);
  const [aspectRatio, setAspectRatio] = useState(3 / 2);
  const [editingAnchor, setEditingAnchor] = useState(false);
  const selectedStructure = structures.find((structure) => structure.id === selectedStructureId);
  const visibleImage = image?.uri === imageUri ? image : null;
  const keptIds = new Set([...keeps.map((keep) => keep.structureId), ...structures.filter((structure) => structure.immutable).map((structure) => structure.id)]);
  const markers = structures.filter((structure) => isValidAnchor(structure.photoAnchor));

  useEffect(() => {
    let cancelled = false;
    let resolved = '';
    void resolveImageUri(imageUri).then((src) => {
      resolved = src;
      if (cancelled) revokeImageUrl(src);
      else setImage({ uri: imageUri, src });
    }).catch((cause: unknown) => {
      if (!cancelled) setImage({
        uri: imageUri,
        error: cause instanceof Error ? cause.message : '사진을 불러오지 못했습니다.',
      });
    });
    return () => {
      cancelled = true;
      revokeImageUrl(resolved);
    };
  }, [imageUri]);

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
  }

  function handleImageError() {
    setImage({ uri: imageUri, error: '사진을 표시하지 못했습니다. 원본 파일을 다시 확인해 주세요.' });
  }

  function handlePhotoClick(event: MouseEvent<HTMLDivElement>) {
    if (!editingAnchor || !selectedStructure || !visibleImage?.src) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    onSetAnchor(selectedStructure.id, {
      x: clampFraction((event.clientX - bounds.left) / bounds.width),
      y: clampFraction((event.clientY - bounds.top) / bounds.height),
    });
  }

  function handleManualAnchor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStructure) return;
    const data = new FormData(event.currentTarget);
    const x = Number(data.get('x'));
    const y = Number(data.get('y'));
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
    onSetAnchor(selectedStructure.id, { x: x / 100, y: y / 100 });
  }

  return <section className="photo-keep-overlay" aria-label="기존 공간 사진의 Keep 표시">
    <div className="photo-keep-overlay__heading">
      <div>
        <strong>기존 공간 사진</strong>
        <p id={instructionId}>사진상의 대략적 표시 · 실제 배치와 치수 판단은 도면에서 확인하세요.</p>
        {selectedStructure && <p className="photo-keep-overlay__selected-info">선택: {selectedStructure.name} · {selectedStructure.immutable ? '필수 보존' : '수정 가능'} · 사진 라벨만 편집 가능</p>}
      </div>
      <span className="photo-keep-overlay__count">표시 {markers.length}개</span>
    </div>

    {visibleImage?.error ? <div className="photo-keep-overlay__empty" role="alert">{visibleImage.error}</div> :
      !visibleImage?.src ? <div className="photo-keep-overlay__empty" role="status">기존 공간 사진을 불러오는 중입니다.</div> :
        <div className="photo-keep-overlay__stage">
          <div
            className={`photo-keep-overlay__image-frame${editingAnchor && selectedStructure ? ' photo-keep-overlay__image-frame--editable' : ''}`}
            style={{ aspectRatio }}
            onClick={handlePhotoClick}
            aria-describedby={instructionId}
          >
            <img
              className="photo-keep-overlay__image"
              src={visibleImage.src}
              alt="기존 공간 사진. 표시된 구조물은 사진에서의 대략적인 위치입니다."
              onLoad={handleImageLoad}
              onError={handleImageError}
              draggable={false}
            />
            {markers.map((structure) => {
              const anchor = structure.photoAnchor!;
              const kept = keptIds.has(structure.id);
              const selected = structure.id === selectedStructureId;
              return <button
                key={structure.id}
                type="button"
                className={`photo-keep-overlay__marker${kept ? ' photo-keep-overlay__marker--kept' : ''}${selected ? ' photo-keep-overlay__marker--selected' : ''}${anchor.x > .78 ? ' photo-keep-overlay__marker--edge-right' : anchor.x < .22 ? ' photo-keep-overlay__marker--edge-left' : ''}`}
                style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
                aria-label={`${structure.name}, ${structure.immutable ? '필수 보존 기본 구조' : kept ? 'Keep 보존 대상' : '수정 가능한 구조'}, 사진상의 대략적 표시`}
                aria-pressed={selected}
                onClick={(event) => { event.stopPropagation(); onSelect(structure.id); setEditingAnchor(false); }}
              >
                {kept && <span className="photo-keep-overlay__marker-dot" aria-hidden="true"><NucleoIcon name="lock" /></span>}
                <span className="photo-keep-overlay__marker-label">{structure.name}</span>
              </button>;
            })}
          </div>
        </div>}

    <div className="photo-keep-overlay__editor">
      {selectedStructure ? <>
        <p><strong>선택: {selectedStructure.name}</strong> · {selectedStructure.immutable ? '필수 보존 기본 구조, 실제 위치 고정' : '추가 구조'}</p>
        <p>사진 위 표시는 구조물 자체가 아닌 설명 라벨입니다. 도면의 위치·형태는 여기서 바뀌지 않습니다.</p>
        <button type="button" className="photo-keep-overlay__edit-toggle" aria-pressed={editingAnchor} onClick={() => setEditingAnchor((value) => !value)}>{editingAnchor ? '라벨 편집 종료' : '사진 라벨 위치 편집'}</button>
        {editingAnchor && <><p>사진에서 라벨을 놓을 지점을 클릭하세요. 숫자 입력은 선택 사항입니다.</p>
        <form
          key={`${selectedStructure.id}-${selectedStructure.photoAnchor?.x ?? 'none'}-${selectedStructure.photoAnchor?.y ?? 'none'}`}
          className="photo-keep-overlay__coordinates"
          onSubmit={handleManualAnchor}
        >
          <label>X (%)<input name="x" type="number" min="0" max="100" step="1" required defaultValue={Math.round((selectedStructure.photoAnchor?.x ?? 0.5) * 100)} /></label>
          <label>Y (%)<input name="y" type="number" min="0" max="100" step="1" required defaultValue={Math.round((selectedStructure.photoAnchor?.y ?? 0.5) * 100)} /></label>
          <button type="submit">위치 적용</button>
        </form></>}
      </> : <p>구조물을 선택하면 사진상의 대략적 표시 위치를 지정할 수 있습니다.</p>}
    </div>
  </section>;
}
