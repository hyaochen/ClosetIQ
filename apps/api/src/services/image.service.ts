import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

const STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || './data/images';
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface ProcessedImage {
  originalPath: string;
  displayPath: string;
  thumbnailPath: string;
}

export interface ProcessImageOptions {
  // Optional sub-directory under the user folder (e.g. 'ootd' -> <userId>/ootd/original/...)
  subdir?: string;
  // Thumbnail box (default 300x300 cover crop)
  thumbnail?: { width: number; height: number };
}

export async function ensureImageDirs(userId: string, subdir?: string) {
  const dirs = ['original', 'display', 'thumbnail'];
  for (const dir of dirs) {
    await fs.mkdir(path.join(STORAGE_PATH, userId, ...(subdir ? [subdir] : []), dir), { recursive: true });
  }
}

export async function deleteImageFiles(paths: Array<string | null | undefined>) {
  for (const filePath of paths) {
    if (!filePath) continue;
    try {
      await fs.unlink(path.join(STORAGE_PATH, filePath));
    } catch {
      // File may not exist, ignore
    }
  }
}

export async function processAndSaveImage(
  buffer: Buffer,
  mimetype: string,
  userId: string,
  options: ProcessImageOptions = {}
): Promise<ProcessedImage> {
  const sub = options.subdir ? [options.subdir] : [];
  const thumbW = options.thumbnail?.width ?? 300;
  const thumbH = options.thumbnail?.height ?? 300;
  // Validate
  if (!ALLOWED_MIMES.includes(mimetype)) {
    throw new Error('不支援此圖片格式，請使用 JPEG、PNG、WebP 或 HEIC');
  }
  if (buffer.length > MAX_SIZE) {
    throw new Error('圖片大小不可超過 10MB');
  }

  await ensureImageDirs(userId, options.subdir);

  const id = randomUUID();
  const ext = '.webp';

  // Save original
  const originalFilename = `${id}-original${ext}`;
  const originalPath = path.join(userId, ...sub, 'original', originalFilename);
  await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF
    .webp({ quality: 90 })
    .toFile(path.join(STORAGE_PATH, originalPath));

  // Generate display version (max 800px)
  const displayFilename = `${id}-display${ext}`;
  const displayPath = path.join(userId, ...sub, 'display', displayFilename);
  await sharp(buffer)
    .rotate()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(STORAGE_PATH, displayPath));

  // Generate thumbnail (300px square, cover crop)
  const thumbnailFilename = `${id}-thumbnail${ext}`;
  const thumbnailPath = path.join(userId, ...sub, 'thumbnail', thumbnailFilename);
  await sharp(buffer)
    .rotate()
    .resize(thumbW, thumbH, { fit: 'cover' })
    .webp({ quality: 75 })
    .toFile(path.join(STORAGE_PATH, thumbnailPath));

  // Normalize to forward slashes for cross-platform compatibility
  return {
    originalPath: originalPath.replace(/\\/g, '/'),
    displayPath: displayPath.replace(/\\/g, '/'),
    thumbnailPath: thumbnailPath.replace(/\\/g, '/'),
  };
}

export async function saveClothingImage(
  clothingItemId: string,
  buffer: Buffer,
  mimetype: string,
  userId: string,
  isPrimary: boolean = false
) {
  const paths = await processAndSaveImage(buffer, mimetype, userId);

  // If setting as primary, unset other primaries
  if (isPrimary) {
    await prisma.clothingImage.updateMany({
      where: { clothingItemId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const image = await prisma.clothingImage.create({
    data: {
      clothingItemId,
      originalPath: paths.originalPath,
      displayPath: paths.displayPath,
      thumbnailPath: paths.thumbnailPath,
      isPrimary,
    },
  });

  return image;
}

export async function deleteClothingImage(imageId: string) {
  const image = await prisma.clothingImage.findUnique({ where: { id: imageId } });
  if (!image) return;

  // Delete files
  const filePaths = [image.originalPath, image.displayPath, image.thumbnailPath];
  for (const filePath of filePaths) {
    try {
      await fs.unlink(path.join(STORAGE_PATH, filePath));
    } catch {
      // File may not exist, ignore
    }
  }

  await prisma.clothingImage.delete({ where: { id: imageId } });
}
