import { useRef, useEffect, useCallback, useState } from 'react'
import { clamp, computeContainGeometry } from '@/utils/canvas'
import type { SegmentationPoint, MaskData } from '@/types/sam'

const MASK_COLOR = { r: 139, g: 92, b: 246 }

interface SegmentationCanvasProps {
  imageUrl: string | null
  maskOpacity: number
  maskData: MaskData | null
  isModelReady: boolean
  isEmbeddingReady: boolean
  isEncoding: boolean
  isDecoding: boolean
  onDecode: (points: SegmentationPoint[]) => void
  onAllPointsCleared: () => void
  clearTrigger: number
}

// Stored as normalized fractions (0–1) relative to the image area.
// Pixel position is derived from `geometry` at render time so markers
// follow the image when the window is resized.
interface PointMarker {
  relX: number
  relY: number
  label: 0 | 1
}

export function SegmentationCanvas({
  imageUrl,
  maskOpacity,
  maskData,
  isModelReady,
  isEmbeddingReady,
  isEncoding,
  isDecoding,
  onDecode,
  onAllPointsCleared,
  clearTrigger,
}: SegmentationCanvasProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const imageRef      = useRef<HTMLImageElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)

  const pointsRef         = useRef<SegmentationPoint[]>([])
  const isMultiMaskRef    = useRef(false)
  const [markers, setMarkers]   = useState<PointMarker[]>([])
  const [geometry, setGeometry] = useState({ width: 0, height: 0, top: 0, left: 0 })

  // ── Geometry ───────────────────────────────────────────────────────────────
  const updateGeometry = useCallback(() => {
    const img = imageRef.current
    const container = containerRef.current
    if (!img || !container || !img.naturalWidth) return
    setGeometry(computeContainGeometry(
      container.clientWidth, container.clientHeight,
      img.naturalWidth, img.naturalHeight,
    ))
  }, [])

  useEffect(() => {
    window.addEventListener('resize', updateGeometry)
    return () => window.removeEventListener('resize', updateGeometry)
  }, [updateGeometry])

  // ── Reset when image changes ───────────────────────────────────────────────
  useEffect(() => {
    pointsRef.current = []
    isMultiMaskRef.current = false
    setMarkers([])
    const ctx = maskCanvasRef.current?.getContext('2d')
    if (ctx && maskCanvasRef.current) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
    }
  }, [imageUrl])

  // ── Clear points when triggered from outside ───────────────────────────────
  useEffect(() => {
    if (clearTrigger === 0) return
    pointsRef.current = []
    isMultiMaskRef.current = false
    setMarkers([])
    const ctx = maskCanvasRef.current?.getContext('2d')
    if (ctx && maskCanvasRef.current) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
    }
  }, [clearTrigger])

  // ── Render mask when maskData arrives ─────────────────────────────────────
  useEffect(() => {
    const canvas = maskCanvasRef.current
    if (!canvas || !maskData) return

    const { mask, scores, bestIndex } = maskData
    const { width: w, height: h } = mask
    const numMasks = scores.length

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(w, h)
    const px = imageData.data

    for (let i = 0; i < w * h; i++) {
      if (mask.data[numMasks * i + bestIndex] === 1) {
        const off = 4 * i
        px[off]     = MASK_COLOR.r
        px[off + 1] = MASK_COLOR.g
        px[off + 2] = MASK_COLOR.b
        px[off + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
    updateGeometry()
  }, [maskData, updateGeometry])

  // ── Mask opacity ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (maskCanvasRef.current) {
      maskCanvasRef.current.style.opacity = String(maskOpacity)
    }
  }, [maskOpacity])

  // ── Clear mask canvas overlay ──────────────────────────────────────────────
  const clearMaskCanvas = useCallback(() => {
    const ctx = maskCanvasRef.current?.getContext('2d')
    if (ctx && maskCanvasRef.current) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
    }
  }, [])

  // ── Add a point (shared by click and context menu) ─────────────────────────
  const addPoint = useCallback((e: React.MouseEvent, label: 0 | 1) => {
    if (!isEmbeddingReady || isDecoding) return

    const canvas = maskCanvasRef.current
    if (!canvas) return
    const bb = canvas.getBoundingClientRect()
    if (bb.width === 0 || bb.height === 0) return

    if (!isMultiMaskRef.current) {
      pointsRef.current = []
      isMultiMaskRef.current = true
    }

    const position: [number, number] = [
      clamp((e.clientX - bb.left) / bb.width),
      clamp((e.clientY - bb.top) / bb.height),
    ]
    const point: SegmentationPoint = { position, label }
    pointsRef.current.push(point)

    setMarkers(prev => [
      ...prev,
      { relX: position[0], relY: position[1], label },
    ])

    onDecode(pointsRef.current)
  }, [isEmbeddingReady, isDecoding, onDecode])

  // ── Left click → include (label 1) ────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    addPoint(e, 1)
  }, [addPoint])

  // ── Right click → exclude (label 0) ───────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    addPoint(e, 0)
  }, [addPoint])

  // ── Click marker → remove that single point ────────────────────────────────
  const handleRemovePoint = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    const newPoints = pointsRef.current.filter((_, i) => i !== index)
    pointsRef.current = newPoints
    setMarkers(prev => prev.filter((_, i) => i !== index))

    if (newPoints.length === 0) {
      isMultiMaskRef.current = false
      clearMaskCanvas()
      onAllPointsCleared()
    } else {
      onDecode(newPoints)
    }
  }, [onDecode, onAllPointsCleared, clearMaskCanvas])

  const isWorking = isEncoding || isDecoding

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${isEmbeddingReady && !isDecoding ? 'segment-cursor' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Image */}
      {imageUrl ? (
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Segmentation target"
          className="absolute"
          style={{ top: geometry.top, left: geometry.left, width: geometry.width, height: geometry.height, display: 'block' }}
          onLoad={updateGeometry}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="text-slate-500 text-center">
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-lg font-medium text-slate-400">No image loaded</p>
            <p className="text-sm text-slate-600 mt-1">Upload an image or pick an example from the sidebar</p>
          </div>
        </div>
      )}

      {/* Mask canvas */}
      <canvas
        ref={maskCanvasRef}
        className="absolute pointer-events-none"
        style={{ top: geometry.top, left: geometry.left, width: geometry.width, height: geometry.height, opacity: maskOpacity, imageRendering: 'pixelated' }}
      />

      {/* Point markers — pixel pos derived from geometry so they scale with the image */}
      {markers.map((marker, i) => {
        const px = geometry.left + marker.relX * geometry.width
        const py = geometry.top  + marker.relY * geometry.height
        return (
          <div
            key={i}
            className="absolute group cursor-pointer"
            style={{ left: px, top: py, transform: 'translate(-50%, -50%)', zIndex: 10 }}
            onClick={(e) => handleRemovePoint(e, i)}
            title="Click to remove this point"
          >
            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-md transition-all
              group-hover:scale-150 group-hover:opacity-60
              ${marker.label === 1 ? 'bg-green-500' : 'bg-red-500'}`}
            />
          </div>
        )
      })}

      {/* Loading/working overlay */}
      {((!isModelReady && imageUrl) || isWorking) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300 text-sm font-medium">
              {!isModelReady ? 'Model loading…' : isEncoding ? 'Extracting embedding…' : 'Generating mask…'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
