'use client'

/**
 * <SignaturePad> — capture a human signature as either a typed legal name or a
 * drawn mark (canvas). Controlled: emits { type, data } on every change.
 *  - typed → data is the typed string
 *  - drawn → data is a PNG data-URL of the strokes
 *
 * Presentation only — it does NOT submit. <AgreementForm> (or any consumer) reads
 * the value and POSTs it to /api/sign-ops/capture, where the tamper-evidence hash
 * is computed server-side. Pointer events cover mouse + touch + stylus.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type SignatureValue = { type: 'typed' | 'drawn'; data: string }

export interface SignaturePadProps {
  value?: SignatureValue
  onChange?: (value: SignatureValue) => void
  /** Prefill the typed name (e.g. the logged-in user's name). */
  defaultName?: string
  /** Start on 'typed' (default) or 'drawn'. */
  defaultMode?: 'typed' | 'drawn'
  disabled?: boolean
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  defaultName = '',
  defaultMode = 'typed',
  disabled = false,
}) => {
  const [mode, setMode] = useState<'typed' | 'drawn'>(value?.type ?? defaultMode)
  const [typed, setTyped] = useState(value?.type === 'typed' ? value.data : defaultName)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const hasStrokeRef = useRef(false)

  const emit = useCallback(
    (v: SignatureValue) => onChange?.(v),
    [onChange],
  )

  // Keep typed value flowing up.
  useEffect(() => {
    if (mode === 'typed') emit({ type: 'typed', data: typed })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, typed])

  // ── Canvas drawing ─────────────────────────────────────────────
  const ctx = () => canvasRef.current?.getContext('2d') ?? null

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    drawingRef.current = true
    const c = ctx()
    if (!c) return
    const { x, y } = pointerPos(e)
    c.beginPath()
    c.moveTo(x, y)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return
    const c = ctx()
    if (!c) return
    const { x, y } = pointerPos(e)
    c.lineTo(x, y)
    c.strokeStyle = '#111827'
    c.lineWidth = 2
    c.lineJoin = 'round'
    c.lineCap = 'round'
    c.stroke()
    hasStrokeRef.current = true
  }

  const endDraw = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (hasStrokeRef.current && canvasRef.current) {
      emit({ type: 'drawn', data: canvasRef.current.toDataURL('image/png') })
    }
  }

  const clearCanvas = () => {
    const c = ctx()
    if (c && canvasRef.current) {
      c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    hasStrokeRef.current = false
    emit({ type: 'drawn', data: '' })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="Signature method">
        <Button
          type="button"
          variant={mode === 'typed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('typed')}
          disabled={disabled}
          role="tab"
          aria-selected={mode === 'typed'}
        >
          Type
        </Button>
        <Button
          type="button"
          variant={mode === 'drawn' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('drawn')}
          disabled={disabled}
          role="tab"
          aria-selected={mode === 'drawn'}
        >
          Draw
        </Button>
      </div>

      {mode === 'typed' ? (
        <div>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your full legal name"
            disabled={disabled}
            aria-label="Typed signature"
            className="font-serif text-lg"
            autoComplete="name"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Typing your name is a legally binding electronic signature.
          </p>
        </div>
      ) : (
        <div>
          <canvas
            ref={canvasRef}
            width={500}
            height={160}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full max-w-[500px] touch-none rounded-md border border-input bg-white"
            aria-label="Draw your signature"
            style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Draw your signature above.</p>
            <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} disabled={disabled}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SignaturePad
