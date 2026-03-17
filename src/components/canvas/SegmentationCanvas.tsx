import { useRef, useEffect, useCallback, useState } from 'react'
import { clamp, computeContainGeometry } from '@/utils/canvas'
import type { SegmentationPoint, MaskData, RawImageData } from '@/types/sam'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = any

const MASK_COLOR = { r: 139, g: 92, b: 246 } // violet-500

interface SegmentationCanvasProps {
  model: AnyModel | null
  processor: AnyModel | null
  imageUrl: string | null
  maskOpacity: number
  onMaskGenerated: (maskData: MaskData, rawImage: RawImageData) => void
  onStatusChange: (msg: string) => void
  isModelReady: boolean
}

interface PointMarker {
  x: number   // pixel position in container coords
  y: number
  label: 0 | 1
}

export function SegmentationCanvas({
  model,
  processor,
  imageUrl,
  maskOpacity,
  onMaskGenerated,
  onStatusChange,
  isModelReady,
}: SegmentationCanvasProps) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const imageRef       = useRef<HTMLImageElement>(null)
  const maskCanvasRef  = useRef<HTMLCanvasElement>(null)

  // SAM state (refs to avoid stale closures in event handlers)
  const imageInputRef      = useRef<AnyModel>(null)
  const imageProcessedRef  = useRef<AnyModel>(null)
  const imageEmbeddingsRef = useRef<AnyModel>(null)
  const pointsRef          = useRef<SegmentationPoint[]>([])
  const isMultiMaskModeRef   = useRef(false)
  const isEncodingRef        = useRef(false)
  const isDecodingRef        = useRef(false)
  const decodePendingRef     = useRef(false)
  const lastMoveDecodeRef    = useRef(0)
  const maskDataRef        = useRef<MaskData | null>(null)

  const [markers, setMarkers]     = useState<PointMarker[]>([])
  const [geometry, setGeometry]   = useState({ width: 0, height: 0, top: 0, left: 0 })
  const [hasImage, setHasImage]   = useState(false)

  // ── Canvas geometry ────────────────────────────────────────────────────────
  const updateGeometry = useCallback(() => {
    const img = imageRef.current
    const container = containerRef.current
    if (!img || !container || !img.naturalWidth) return
    const geo = computeContainGeometry(
      container.clientWidth,
      container.clientHeight,
      img.naturalWidth,
      img.naturalHeight,
    )
    setGeometry(geo)
  }, [])

  useEffect(() => {
    window.addEventListener('resize', updateGeometry)
    return () => window.removeEventListener('resize', updateGeometry)
  }, [updateGeometry])

  // ── Mask overlay rendering ─────────────────────────────────────────────────
  const renderMask = useCallback((mask: MaskData['mask'], scores: MaskData['scores'], bestIndex: number) => {
    const canvas = maskCanvasRef.current
    if (!canvas) return

    const w = mask.width
    const h = mask.height
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
  }, [updateGeometry])

  // ── Decode (mask prediction) ───────────────────────────────────────────────
  const decode = useCallback(async () => {
    if (isDecodingRef.current || !imageEmbeddingsRef.current || pointsRef.current.length === 0) {
      if (isDecodingRef.current) decodePendingRef.current = true
      return
    }
    if (!model || !processor) return
    isDecodingRef.current = true

    let input_points: AnyModel | null = null
    let input_labels: AnyModel | null = null
    let pred_masks: AnyModel | null = null
    let iou_scores: AnyModel | null = null

    try {
      const { Tensor, RawImage } = await import('@huggingface/transformers')

      const reshaped = imageProcessedRef.current.reshaped_input_sizes[0]
      const pts = pointsRef.current
      const pointsFlat = pts.map((p) => [p.position[0] * reshaped[1], p.position[1] * reshaped[0]]).flat()
      const labelsFlat = pts.map((p) => BigInt(p.label))
      const numPoints = pts.length

      input_points = new Tensor('float32', pointsFlat, [1, 1, numPoints, 2])
      input_labels = new Tensor('int64', labelsFlat, [1, 1, numPoints])

      const result = await model({
        ...imageEmbeddingsRef.current,
        input_points,
        input_labels,
      })
      pred_masks = result.pred_masks
      iou_scores = result.iou_scores

      const masks = await processor.post_process_masks(
        pred_masks,
        imageProcessedRef.current.original_sizes,
        imageProcessedRef.current.reshaped_input_sizes,
      )

      const mask = RawImage.fromTensor(masks[0][0])
      const scores = iou_scores.data as Float32Array

      let bestIndex = 0
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > scores[bestIndex]) bestIndex = i
      }

      const maskData: MaskData = { mask, scores, bestIndex, numMasks: scores.length }
      maskDataRef.current = maskData

      renderMask(mask, scores, bestIndex)
      onStatusChange(`Segment score: ${scores[bestIndex].toFixed(3)}`)

      if (imageInputRef.current) {
        onMaskGenerated(maskData, {
          data: imageInputRef.current.data,
          width: imageInputRef.current.width,
          height: imageInputRef.current.height,
          channels: imageInputRef.current.channels || 3,
        })
      }
    } catch (err) {
      console.error('Decode error:', err)
      onStatusChange('Error generating mask.')
    } finally {
      // Dispose tensors to prevent memory leaks
      input_points?.dispose?.()
      input_labels?.dispose?.()
      pred_masks?.dispose?.()
      iou_scores?.dispose?.()
      isDecodingRef.current = false
    }

    // Don't immediately re-trigger — the next mousemove/click will call decode naturally.
    // This prevents a tight decode loop that saturates the CPU.
    decodePendingRef.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, processor, renderMask, onMaskGenerated, onStatusChange])

  // ── Encode (image embedding) ───────────────────────────────────────────────
  const encode = useCallback(async (url: string) => {
    if (isEncodingRef.current || !model || !processor) return
    isEncodingRef.current = true
    onStatusChange('Extracting image embedding…')

    try {
      const { RawImage } = await import('@huggingface/transformers')

      // Dispose previous embeddings to free memory
      if (imageEmbeddingsRef.current) {
        for (const val of Object.values(imageEmbeddingsRef.current)) {
          (val as AnyModel)?.dispose?.()
        }
      }
      imageProcessedRef.current?.pixel_values?.dispose?.()

      imageInputRef.current = await RawImage.fromURL(url)
      imageProcessedRef.current = await processor(imageInputRef.current)
      imageEmbeddingsRef.current = await model.get_image_embeddings(imageProcessedRef.current)

      onStatusChange('Embedding ready — click on the image to segment!')
      setHasImage(true)
      updateGeometry()
    } catch (err) {
      console.error('Encode error:', err)
      onStatusChange('Error loading image. Please try again.')
    } finally {
      isEncodingRef.current = false
    }
  }, [model, processor, onStatusChange, updateGeometry])

  // ── React to imageUrl prop changes ─────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl || !isModelReady) return

    // Reset points/mask on new image
    pointsRef.current = []
    isMultiMaskModeRef.current = false
    maskDataRef.current = null
    setMarkers([])
    const ctx = maskCanvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height)

    setHasImage(false)
    encode(imageUrl)
  }, [imageUrl, isModelReady, encode])

  // Update mask canvas opacity
  useEffect(() => {
    if (maskCanvasRef.current) {
      maskCanvasRef.current.style.opacity = String(maskOpacity)
    }
  }, [maskOpacity])

  // ── Point interaction ──────────────────────────────────────────────────────
  const getPoint = useCallback((e: React.MouseEvent): SegmentationPoint | null => {
    const canvas = maskCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return null

    const canvasBB = canvas.getBoundingClientRect()
    if (canvasBB.width === 0 || canvasBB.height === 0) return null

    return {
      position: [
        clamp((e.clientX - canvasBB.left) / canvasBB.width),
        clamp((e.clientY - canvasBB.top) / canvasBB.height),
      ],
      label: e.button === 2 ? 0 : 1,
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!imageEmbeddingsRef.current || !hasImage) return
    if (e.button !== 0 && e.button !== 2) return

    if (!isMultiMaskModeRef.current) {
      pointsRef.current = []
      isMultiMaskModeRef.current = true
    }

    const point = getPoint(e)
    if (!point) return
    pointsRef.current.push(point)

    // Add marker at container-relative pixel coords
    const canvasBB = maskCanvasRef.current!.getBoundingClientRect()
    const containerBB = containerRef.current!.getBoundingClientRect()
    setMarkers((prev) => [
      ...prev,
      {
        x: canvasBB.left - containerBB.left + point.position[0] * canvasBB.width,
        y: canvasBB.top - containerBB.top + point.position[1] * canvasBB.height,
        label: point.label,
      },
    ])

    decode()
  }, [hasImage, getPoint, decode])

  const MOUSE_MOVE_THROTTLE_MS = 150

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!imageEmbeddingsRef.current || isMultiMaskModeRef.current || !hasImage) return
    const now = Date.now()
    if (now - lastMoveDecodeRef.current < MOUSE_MOVE_THROTTLE_MS) return
    lastMoveDecodeRef.current = now
    const point = getPoint(e)
    if (!point) return
    pointsRef.current = [point]
    decode()
  }, [hasImage, getPoint, decode])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  // ── Exposed methods for parent ────────────────────────────────────────────
  // (accessed via imperative handle if needed — but we'll use callbacks instead)

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${hasImage ? 'segment-cursor' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
    >
      {/* Image */}
      {imageUrl ? (
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Segmentation target"
          className="absolute"
          style={{
            top: geometry.top,
            left: geometry.left,
            width: geometry.width,
            height: geometry.height,
            display: 'block',
          }}
          onLoad={updateGeometry}
          draggable={false}
        />
      ) : (
        /* Empty state */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="text-slate-500 text-center">
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-lg font-medium text-slate-400">No image loaded</p>
            <p className="text-sm text-slate-600 mt-1">
              Upload an image or pick an example from the sidebar
            </p>
          </div>
        </div>
      )}

      {/* Mask canvas overlay */}
      <canvas
        ref={maskCanvasRef}
        className="absolute pointer-events-none"
        style={{
          top: geometry.top,
          left: geometry.left,
          width: geometry.width,
          height: geometry.height,
          opacity: maskOpacity,
          imageRendering: 'pixelated',
        }}
      />

      {/* Point markers */}
      {markers.map((marker, i) => (
        <span
          key={i}
          className="absolute select-none pointer-events-none text-xl"
          style={{
            left: marker.x,
            top: marker.y,
            transform: 'translate(-50%, -50%)',
            textShadow: '0 0 6px rgba(0,0,0,0.7)',
            zIndex: 10,
          }}
        >
          {marker.label === 1 ? '⭐' : '❌'}
        </span>
      ))}

      {/* Not ready overlay */}
      {!isModelReady && imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <p className="text-slate-300 text-sm font-medium">Model loading — please wait…</p>
        </div>
      )}
    </div>
  )
}

// Expose clear/reset methods to parent
export interface SegmentationCanvasRef {
  clearPoints: () => void
  reset: () => void
}
