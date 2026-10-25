import type { Category, ExtractedField, PosterExtraction } from '../types'
import { delay } from './bus'

/**
 * POSTER EXTRACTION — MOCK IMPLEMENTATION.
 *
 * No OCR or vision model is connected. This function ignores the image content and returns
 * fixed sample values so the review workflow can be demonstrated. The UI labels the result as a mock.
 *
 * Integration point: replace the body with a call to your OCR / vision API, e.g.
 *   const form = new FormData(); form.append('poster', file)
 *   const res = await fetch('/api/poster-extract', { method: 'POST', body: form })
 *   return (await res.json()) as PosterExtraction
 * Keep the return shape (PosterExtraction) and set `isMock: false`.
 */
export async function extractEventFromPoster(
  file: File,
  onProgress?: (percent: number, label: string) => void,
): Promise<PosterExtraction> {
  const steps: [number, string][] = [
    [15, 'Uploading poster'],
    [40, 'Detecting text regions'],
    [70, 'Reading event details'],
    [90, 'Structuring fields'],
  ]
  for (const [pct, label] of steps) {
    onProgress?.(pct, label)
    await delay(550)
  }
  onProgress?.(100, 'Done')
  void file

  const ok = (value: string, note?: string): ExtractedField => ({ value, state: 'ok', note })
  const review = (value: string, note: string): ExtractedField => ({ value, state: 'review', note })
  const missing = (note: string): ExtractedField => ({ value: '', state: 'missing', note })

  const dateIso = new Date(Date.now() + 10 * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${dateIso.getFullYear()}-${pad(dateIso.getMonth() + 1)}-${pad(dateIso.getDate())}`

  return {
    isMock: true,
    title: ok('Sample Poster Event: Intro to Web Dev'),
    description: review('Learn the basics of building websites. (Sample text — please rewrite.)', 'Short text found on poster; add more detail.'),
    category: { value: 'Web Development' as Category, state: 'review', note: 'Guessed from the title.' },
    startDate: review(date, 'Date was partially visible. Confirm the day.'),
    startTime: ok('17:00'),
    endTime: missing('End time was not found on the poster.'),
    venueName: ok('Sample Community Hall'),
    address: missing('No street address detected.'),
    price: review('0', 'Looked like "Free entry" but the text was blurry.'),
    registrationUrl: missing('No link or QR code detected.'),
  }
}
