import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { StorageUploadResult } from '../types'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import { readStoredFiles, writeStoredFiles } from './db'

export const ALLOWED_PUBLIC_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]

export const ALLOWED_PRIVATE_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'text/plain',
  'application/json',
]

export const MAX_PUBLIC_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
export const MAX_PRIVATE_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

/**
 * Validates file size and MIME type according to target bucket rules.
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  bucket: 'public-assets' | 'project-submissions' | string,
): { valid: boolean; error?: string } {
  if (bucket === 'public-assets') {
    if (file.size > MAX_PUBLIC_FILE_SIZE) {
      return { valid: false, error: 'File size exceeds maximum allowed 5 MB for public assets.' }
    }
    if (file.type && !ALLOWED_PUBLIC_MIME_TYPES.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        error: `Invalid file type "${file.type}". Allowed: PNG, JPEG, WebP, SVG.`,
      }
    }
  } else if (bucket === 'project-submissions') {
    if (file.size > MAX_PRIVATE_FILE_SIZE) {
      return { valid: false, error: 'File size exceeds maximum allowed 25 MB for project files.' }
    }
    if (file.type && !ALLOWED_PRIVATE_MIME_TYPES.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        error: `Invalid file type "${file.type}". Allowed: PDF, ZIP, Images, MP4, Text.`,
      }
    }
  }
  return { valid: true }
}

/**
 * Uploads a file to Supabase Storage with strict size/mime validation.
 */
export async function uploadFile(
  bucket: 'public-assets' | 'project-submissions',
  path: string,
  file: File | Blob | { name: string; size: number; type: string; data?: any },
  options: { isPrivate?: boolean } = {},
): Promise<StorageUploadResult> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: You must be signed in to upload files.')
  }

  // Enforce validation
  const validation = validateFile(
    {
      name: (file as any).name || 'file',
      size: file.size,
      type: file.type || 'application/octet-stream',
    },
    bucket,
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // 1. Supabase Storage if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file as any, {
        upsert: false,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data) {
        if (bucket === 'public-assets') {
          const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path)
          return { path: data.path, publicUrl: pubData.publicUrl }
        } else {
          // Private signed URL default 1 hour
          const { data: signedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600)
          return { path: data.path, signedUrl: signedData?.signedUrl }
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err
      }
      console.warn('Supabase storage upload fallback:', err.message)
    }
  }

  // 2. Strict local storage simulation
  const stored = readStoredFiles()
  const existing = stored.find((f) => f.bucket === bucket && f.storagePath === path)
  if (existing && existing.ownerId !== sessionUser.id) {
    throw new Error('Unauthorized: You cannot overwrite a file belonging to another user.')
  }

  const fileId = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const fileName = (file as any).name || path.split('/').pop() || 'upload.bin'

  const newFileRecord = {
    id: fileId,
    name: fileName,
    sizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    storagePath: path,
    bucket,
    ownerId: sessionUser.id,
    uploadedAt: new Date().toISOString(),
    isPrivate: bucket !== 'public-assets' || !!options.isPrivate,
    url:
      bucket === 'public-assets'
        ? `/mock-storage/${bucket}/${path}`
        : `/mock-storage/signed/${bucket}/${path}?token=${Math.random().toString(36).slice(2, 10)}`,
  }

  writeStoredFiles([...stored.filter((f) => f.storagePath !== path), newFileRecord])

  return {
    path,
    publicUrl: bucket === 'public-assets' ? newFileRecord.url : undefined,
    signedUrl: bucket !== 'public-assets' ? newFileRecord.url : undefined,
  }
}

/**
 * Creates a signed URL for authorized access to a private project file.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  await delay(100)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: You must be signed in to access private project files.')
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds)
      if (error) throw new Error(error.message)
      if (data?.signedUrl) return data.signedUrl
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err
      }
    }
  }

  const stored = readStoredFiles()
  const file = stored.find((f) => f.bucket === bucket && f.storagePath === path)
  if (!file) {
    throw new Error('File not found in storage.')
  }

  // Authorization: owner, event organizer, or admin
  const isAuthorized =
    file.ownerId === sessionUser.id || sessionUser.role === 'organizer' || sessionUser.role === 'admin' || sessionUser.role === 'judge'
  if (!isAuthorized) {
    throw new Error('Unauthorized: You do not have permission to access this private file.')
  }

  return `${file.url}&exp=${Date.now() + expiresInSeconds * 1000}`
}

/**
 * Deletes a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.storage.from(bucket).remove([path])
      if (error) throw new Error(error.message)
      return
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) throw err
    }
  }

  const stored = readStoredFiles()
  const file = stored.find((f) => f.bucket === bucket && f.storagePath === path)
  if (file && file.ownerId !== sessionUser.id && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: You cannot delete files belonging to another user.')
  }

  writeStoredFiles(stored.filter((f) => !(f.bucket === bucket && f.storagePath === path)))
}
