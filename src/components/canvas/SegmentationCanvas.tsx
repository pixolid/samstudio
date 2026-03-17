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
}

interface PointMarker {
  x: number
  y: number
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

  // ── Click handling ─────────────────────────────────────────────────────────
  const getPoint = useCallback((e: React.MouseEvent): SegmentationPoint | null => {
    const canvas = maskCanvasRef.current
    if (!canvas) return null
    const bb = canvas.getBoundingClientRect()
    if (bb.width === 0 || bb.height === 0) return null
    return {
      position: [
        clamp((e.clientX - bb.left) / bb.width),
        clamp((e.clientY - bb.top) / bb.height),
      ],
      label: e.button === 2 ? 0 : 1,
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEmbeddingReady || isDecoding) return
    if (e.button !== 0 && e.button !== 2) return

    if (!isMultiMaskRef.current) {
      pointsRef.current = []
      isMultiMaskRef.current = true
    }

    const point = getPoint(e)
    if (!point) return
    pointsRef.current.push(point)

    const canvasBB = maskCanvasRef.current!.getBoundingClientRect()
    const containerBB = containerRef.current!.getBoundingClientRect()
    setMarkers(prev => [
      ...prev,
      {
        x: canvasBB.left - containerBB.left + point.position[0] * canvasBB.width,
        y: canvasBB.top - containerBB.top + point.position[1] * canvasBB.height,
        label: point.label,
      },
    ])

    onDecode(pointsRef.current)
  }, [isEmbeddingReady, isDecoding, getPoint, onDecode])

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), [])

  const isWorking = isEncoding || isDecoding

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${isEmbeddingReady && !isDecoding ? 'segment-cursor' : ''}`}
      onMouseDown={handleMouseDown}
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

      {/* Point markers */}
      {markers.map((marker, i) => (
        <span
          key={i}
          className="absolute select-none pointer-events-none text-xl"
          style={{ left: marker.x, top: marker.y, transform: 'translate(-50%, -50%)', textShadow: '0 0 6px rgba(0,0,0,0.7)', zIndex: 10 }}
        >
          {marker.label === 1 ? '⭐' : '❌'}
        </span>
      ))}

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