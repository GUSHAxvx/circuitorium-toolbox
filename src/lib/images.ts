// 图片压缩：学生用手机拍的照片动辄 3~8MB，直接存本地既占空间、又会让作品文件过大
// 策略：超过阈值就在浏览器里等比缩到 1600px 内、转 JPEG；小图/动图/矢量图原样保留

export interface CompressResult {
  blob: Blob;
  /** 压缩前字节数 */
  originalBytes: number;
  /** 压缩后字节数 */
  bytes: number;
  /** 是否真的压过 */
  compressed: boolean;
  /** 给用户看的说明，例如「4.2 MB → 380 KB」 */
  note: string;
}

const MAX_EDGE = 1600;
const KEEP_UNDER_BYTES = 400 * 1024; // 小于这个体积就不动它
const QUALITY = 0.85;

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 动图/矢量图不压（压了会丢动画或变模糊） */
function shouldSkip(type: string): boolean {
  return type === 'image/gif' || type === 'image/svg+xml';
}

export async function compressImage(file: Blob): Promise<CompressResult> {
  const originalBytes = file.size;
  const unchanged = (blob: Blob): CompressResult => ({
    blob, originalBytes, bytes: blob.size, compressed: false, note: '',
  });

  if (shouldSkip(file.type)) return unchanged(file);
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return unchanged(file);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return unchanged(file); // 浏览器解不开（少见格式）就原样存
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const tooBig = longest > MAX_EDGE || originalBytes > KEEP_UNDER_BYTES;
  if (!tooBig) {
    bitmap.close?.();
    return unchanged(file);
  }

  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return unchanged(file);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY)
    );
    if (!out) return unchanged(file);

    // 压完反而更大就保留原图
    if (out.size >= originalBytes) return unchanged(file);

    return {
      blob: out,
      originalBytes,
      bytes: out.size,
      compressed: true,
      note: `${formatBytes(originalBytes)} → ${formatBytes(out.size)}`,
    };
  } catch {
    return unchanged(file);
  }
}
