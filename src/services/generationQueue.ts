import { getGenerationStatus, type GenerationStatus } from './imageProvider';

const WAIT_MS = 20_000;
const POLL_MS = 2_000;

/** Only read availability between views. Never retry a paid image request. */
export async function waitForGenerationSlot(onStatus: (status: GenerationStatus) => void): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const status = await getGenerationStatus(Math.min(8_000, deadline - Date.now()));
    onStatus(status);
    const quota = status.quota;
    if (!status.available || !quota || typeof quota.busy !== 'boolean' ||
        !Number.isSafeInteger(quota.remaining) || quota.remaining < 0 ||
        !Number.isSafeInteger(quota.dailyRemaining) || quota.dailyRemaining < 0) {
      throw new Error('다음 시점을 생성할 수 있는지 확인하지 못했습니다. 저장된 이미지를 확인한 뒤 생성 가능 여부를 다시 확인해 주세요.');
    }
    if (quota.remaining === 0) throw new Error('오늘 서비스 전체 생성 한도를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다.');
    if (quota.dailyRemaining === 0) throw new Error('오늘 내 생성 횟수를 모두 사용했습니다. 한국 시간 자정 이후 다시 사용할 수 있습니다.');
    if (!quota.busy) return;
    await new Promise(resolve => setTimeout(resolve, Math.min(POLL_MS, Math.max(0, deadline - Date.now()))));
  }
  throw new Error('서버에서 다른 생성 요청을 처리하고 있어 나머지 시점을 시작하지 못했습니다. 잠시 후 생성 가능 여부를 확인해 주세요.');
}
