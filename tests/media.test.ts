import { describe, it, expect, vi, beforeEach } from 'vitest';
import { imageToSticker, videoToSticker } from '../src/utils/media';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';

// Mock sharp
vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('sticker')),
  }),
}));

// Mock ffmpeg
vi.mock('fluent-ffmpeg', () => {
  const m = vi.fn().mockReturnValue({
    inputOptions: vi.fn().mockReturnThis(),
    videoFilters: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    toFormat: vi.fn().mockReturnThis(),
    save: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation(function(this: any, event, cb) {
      if (event === 'end') setTimeout(cb, 0);
      return this;
    }),
  });
  (m as any).ffprobe = vi.fn((path, cb) => cb(null, { format: { duration: 10 } }));
  return { default: m };
});

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    ensureDirSync: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('video-sticker')),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Media Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('imageToSticker', () => {
    it('should convert image to sticker', async () => {
      const buffer = Buffer.from('image');
      const result = await imageToSticker(buffer);
      
      expect(result.toString()).toBe('sticker');
      expect(sharp).toHaveBeenCalledWith(buffer);
    });
  });

  describe('videoToSticker', () => {
    it('should convert video to sticker with correct filters', async () => {
      const buffer = Buffer.from('video');
      const result = await videoToSticker(buffer);

      expect(result.toString()).toBe('video-sticker');
      expect(ffmpeg).toHaveBeenCalled();
      
      const ffmpegInstance = vi.mocked(ffmpeg).mock.results[0].value;
      expect(ffmpegInstance.videoFilters).toHaveBeenCalledWith(expect.arrayContaining([
        'scale=512:512:force_original_aspect_ratio=decrease',
        'fps=12',
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0',
        'format=rgba'
      ]));
    });

    it('should retry with lower quality if first attempt is too large', async () => {
      const largeBuffer = Buffer.alloc(1024 * 1024 + 1); // > 1MB
      const smallBuffer = Buffer.from('small-sticker');

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(largeBuffer as any)
        .mockResolvedValueOnce(smallBuffer as any);

      const result = await videoToSticker(Buffer.from('video'));

      expect(result).toBe(smallBuffer);
      expect(ffmpeg).toHaveBeenCalledTimes(2);
      
      // Verify second call has lower quality and lower FPS
      const secondCallInstance = vi.mocked(ffmpeg).mock.results[1].value;
      expect(secondCallInstance.outputOptions).toHaveBeenCalledWith(expect.arrayContaining([
        '-quality', '20'
      ]));
      expect(secondCallInstance.videoFilters).toHaveBeenCalledWith(expect.arrayContaining([
        'fps=10'
      ]));
    });

    it('should cleanup temporary files', async () => {
      await videoToSticker(Buffer.from('video'));

      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });
});
