import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { fileToResizedDataUrl } from '../../utils/image'

interface Props {
  id: string
  value?: string
  onChange: (dataUrl: string | undefined, file?: File) => void
  error?: string
  /** Called with the original file, before resizing (used by the poster-to-event workflow). */
  onFile?: (file: File) => void
}

export function PosterUpload({ id, value, onChange, error, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handle = async (file: File | undefined) => {
    if (!file) return
    setLocalError(null)
    try {
      const url = await fileToResizedDataUrl(file)
      onChange(url, file)
      onFile?.(file)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not use that image.')
    }
  }

  const shownError = localError ?? error

  return (
    <div>
      {value ? (
        <div className="overflow-hidden rounded-xl border border-[#334155] bg-secondary">
          <img src={value} alt="Poster preview" className="max-h-72 w-full object-contain bg-canvas" />
          <div className="flex items-center justify-between gap-2 border-t border-[#334155] px-3 py-2">
            <button type="button" className="btn-ghost px-2 py-1.5" onClick={() => inputRef.current?.click()}>
              Replace image
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1.5 text-rose-400 hover:bg-rose-950/40"
              onClick={() => {
                onChange(undefined)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void handle(e.dataTransfer.files[0])
          }}
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
            dragging ? 'border-brand bg-brand/10' : 'border-[#334155] bg-[#0F172A]/70 hover:bg-secondary'
          }`}
        >
          <ImagePlus className="mb-2 h-8 w-8 text-brand" aria-hidden />
          <span className="text-sm font-semibold text-white">Click to upload or drag an image here</span>
          <span className="mt-1 text-xs text-ink-muted">PNG, JPG or WebP · up to 8 MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void handle(e.target.files?.[0])}
        aria-describedby={shownError ? `${id}-error` : undefined}
      />
      {shownError && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-rose-400">
          {shownError}
        </p>
      )}
    </div>
  )
}
