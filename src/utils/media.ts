import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

import logger from './logger';

const tempDir = path.join(process.cwd(), 'storage', 'temp');
fs.ensureDirSync(tempDir);

/**
 * Convert image buffer to WebP sticker buffer.
 * Preserves original aspect ratio with transparent background.
 */
export async function imageToSticker(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp()
    .toBuffer();
}

/**
 * Get video duration in seconds using ffprobe.
 */
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 10);
    });
  });
}

/**
 * Convert video buffer to animated WebP sticker buffer.
 * Optimized for WhatsApp limits (max 6s, < 1MB).
 */
export async function videoToSticker(buffer: Buffer): Promise<Buffer> {
  const ts = Date.now();
  const inputPath = path.join(tempDir, `${ts}_in.mp4`);
  const outputPath = path.join(tempDir, `${ts}_out.webp`);

  await fs.writeFile(inputPath, buffer);

  try {
    const duration = await getVideoDuration(inputPath);
    const maxDuration = Math.min(duration, 6);

    const convert = async (quality: number, fps: number) => {
      return new Promise<Buffer>((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(['-t', `${maxDuration}`])
          .videoFilters([
            'scale=512:512:force_original_aspect_ratio=decrease',
            `fps=${fps}`,
            'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0',
            'format=rgba'
          ])
          .outputOptions([
            '-lossless', '0',
            '-quality', `${quality}`,
            '-compression_level', '6',
            '-loop', '0',
            '-an',
          ])
          .toFormat('webp')
          .save(outputPath)
          .on('end', async () => {
            try {
              const outBuffer = await fs.readFile(outputPath);
              resolve(outBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (err) => {
            reject(err);
          });
      });
    };

    // First attempt: Good quality
    let outBuffer = await convert(40, 12);

    // If still too large, retry with more aggressive compression
    if (outBuffer.length > 1024 * 1024) {
      logger.info({ size: outBuffer.length }, 'Sticker too large, retrying with lower quality');
      outBuffer = await convert(20, 10);
    }

    await cleanup();
    return outBuffer;
  } catch (err) {
    logger.error(err, 'Failed to convert video to sticker');
    await cleanup();
    throw err;
  }

  async function cleanup() {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
