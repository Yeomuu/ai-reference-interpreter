import { REFERENCE_CATALOG } from '../data/referenceCatalog.js';
import type { Project } from './types.js';
import { countReferenceImages } from './prototypeLimits.js';
import { MAX_REFERENCE_IMAGES, REFERENCE_LIMIT_MESSAGE } from './prototypeConfig.js';
import { updateCommon } from './revisions.js';

/** Register only the chosen source; never add furniture or bind it automatically. */
export function registerCatalogReference(project: Project, catalogId: string): {project: Project; referenceId?: string; error?: string} {
  const entry = REFERENCE_CATALOG.find(item=>item.id===catalogId);
  if (!entry) return {project,error:'선택한 기본 레퍼런스를 찾을 수 없습니다.'};
  const existing = project.references.find(ref=>project.sourceImages.some(image=>image.id===ref.imageId&&image.uri===entry.uri));
  if (existing) return {project,referenceId:existing.id};
  if (countReferenceImages(project)>=MAX_REFERENCE_IMAGES) return {project,error:REFERENCE_LIMIT_MESSAGE};
  const imageId = `catalog-image-${entry.id}`, referenceId = `catalog-reference-${entry.id}`;
  // Deletion undo may still hold a past image. Do not rewrite any history.
  if (project.sourceImages.some(image=>image.id===imageId)||project.references.some(ref=>ref.id===referenceId)) return {project,error:'같은 이름의 자료가 있습니다. 기존 레퍼런스를 확인하세요.'};
  return {referenceId,project:updateCommon(project,{
    sourceImages:[...project.sourceImages,{id:imageId,referenceId,role:'inspiration',uri:entry.uri,name:entry.name,width:entry.width,height:entry.height,note:`${entry.description} ${entry.credit}${entry.sourceUrl?` · ${entry.sourceUrl}`:''}`}],
    references:[...project.references,{id:referenceId,imageId,role:'element',note:entry.description,extractedElements:[],exclusions:[]}],
  })};
}
