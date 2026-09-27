const DB_NAME = 'ai-reference-interpreter-assets';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const ASSET_PREFIX = 'asset://';

export type ImagePurpose = 'photo' | 'floor-plan';

export interface StoredImageAsset {
  id: string;
  uri: string;
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  size: number;
}

interface AssetRecord extends StoredImageAsset {
  blob: Blob;
}

export interface ImageFileValidation {
  valid: boolean;
  message?: string;
  mimeType?: StoredImageAsset['mimeType'];
}

const MAX_BYTES: Record<ImagePurpose, number> = {
  photo: 12 * 1024 * 1024,
  'floor-plan': 20 * 1024 * 1024,
};

function detectMime(bytes: Uint8Array): StoredImageAsset['mimeType'] | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Reject wrong MIME, extensions and signatures before anything is persisted. */
export async function validateImageFile(file: File, purpose: ImagePurpose): Promise<ImageFileValidation> {
  if (!file || file.size === 0) return { valid: false, message: '비어 있는 파일은 등록할 수 없습니다.' };
  const maxBytes = MAX_BYTES[purpose];
  if (file.size > maxBytes) {
    return { valid: false, message: `파일 크기는 ${Math.round(maxBytes / 1024 / 1024)}MB 이하여야 합니다.` };
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mimeType = detectMime(bytes);
  if (!mimeType) return { valid: false, message: 'PNG, JPG 또는 WebP 이미지 파일만 등록할 수 있습니다.' };

  const extension = file.name.split('.').pop()?.toLowerCase();
  const permittedExtensions: Record<StoredImageAsset['mimeType'], string[]> = {
    'image/png': ['png'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/webp': ['webp'],
  };
  if (!extension || !permittedExtensions[mimeType].includes(extension) ||
      (file.type && file.type !== mimeType)) {
    return { valid: false, message: '파일 이름, 형식, 실제 이미지 내용이 일치하지 않습니다.' };
  }
  return { valid: true, mimeType };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('이 브라우저에서는 이미지 저장소를 사용할 수 없습니다.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('이미지 저장소를 열지 못했습니다.'));
    request.onblocked = () => reject(new Error('다른 탭에서 이미지 저장소를 사용 중입니다. 해당 탭을 닫고 다시 시도해 주세요.'));
  });
}

function parseAssetId(uri: string): string {
  if (!uri.startsWith(ASSET_PREFIX)) throw new Error('올바르지 않은 이미지 주소입니다.');
  const id = uri.slice(ASSET_PREFIX.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('올바르지 않은 이미지 주소입니다.');
  }
  return id;
}

function writeRecord(record: AssetRecord): Promise<void> {
  return openDatabase().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('이미지를 저장하지 못했습니다.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('이미지를 저장하지 못했습니다.')); };
  }));
}

/** Returns a serializable URI. Never put blob URLs in project JSON. */
export async function putImageAsset(file: File, purpose: ImagePurpose): Promise<StoredImageAsset> {
  const validation = await validateImageFile(file, purpose);
  if (!validation.valid || !validation.mimeType) throw new Error(validation.message ?? '이미지 파일을 확인할 수 없습니다.');
  const id = crypto.randomUUID();
  const asset: StoredImageAsset = {
    id,
    uri: `${ASSET_PREFIX}${id}`,
    name: file.name,
    mimeType: validation.mimeType,
    size: file.size,
  };
  await writeRecord({ ...asset, blob: file });
  return asset;
}

export function getImageAssetBlob(uri: string): Promise<Blob | null> {
  const id = parseAssetId(uri);
  return openDatabase().then((db) => new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as AssetRecord | undefined)?.blob ?? null);
    request.onerror = () => reject(request.error ?? new Error('이미지를 읽지 못했습니다.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    transaction.onabort = () => db.close();
  }));
}

/** Each asset resolution creates its own object URL; call revokeImageUrl on cleanup. */
export async function resolveImageUri(uri: string): Promise<string> {
  if (uri.startsWith('/sample/')) return uri;
  const blob = await getImageAssetBlob(uri);
  if (!blob) throw new Error('저장된 이미지를 찾을 수 없습니다. 다시 등록해 주세요.');
  return URL.createObjectURL(blob);
}

export function revokeImageUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function deleteImageAsset(uri: string): Promise<void> {
  const id = parseAssetId(uri);
  return openDatabase().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('이미지를 삭제하지 못했습니다.')); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('이미지를 삭제하지 못했습니다.')); };
  }));
}
