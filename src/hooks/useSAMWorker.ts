import { useState, useCallback, useRef, useEffect } from 'react'
import type { ModelState, BackendType, MaskData, SegmentationPoint } from '@/types/sam'

interface SAMWorkerHandle {
  state: ModelState
  isEncoding: boolean
  isDecoding: boolean
  isEmbeddingReady: boolean
  loadModel: () => void
  encodeImage: (url: string) => void
  decode: (points: SegmentationPoint[]) => void
  onMaskResult: ((mask: MaskData) => void) | null
  setOnMaskResult: (cb: ((mask: MaskData) => void) | null) => void
  setOnStatusChange: (cb: ((msg: string) => void) | null) => void
}

export function useSAMWorker(): SAMWorkerHandle {
  const workerRef = useRef<Worker | null>(null)
  const onMaskResultRef = useRef<((mask: MaskData) => void) | null>(null)
  const onStatusChangeRef = useRef<((msg: string) => void) | null>(null)

  const [state, setState] = useState<ModelState>({
    status: 'idle',
    backend: null,
    progress: 0,
    statusMessage: 'Ready to load model',
    error: null,
  })
  const [isEncoding, setIsEncoding] = useState(false)
  const [isDecoding, setIsDecoding] = useState(false)
  const [isEmbeddingReady, setIsEmbeddingReady] = useState(false)

  const setPartial = useCallback((partial: Partial<ModelState>) =>
    setState(prev => ({ ...prev, ...partial })), [])

  useEffect(() => {
    const worker = new Worker(new URL('../workers/sam.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      switch (msg.type) {
        case 'status':
          setPartial({ statusMessage: msg.message })
          onStatusChangeRef.current?.(msg.message)
          break
        case 'progress':
          setPartial({ progress: msg.progress })
          break
        case 'model_ready':
          setPartial({
            status: 'ready',
            backend: msg.backend as BackendType,
            progress: 100,
            statusMessage: `SAM 2 ready (${msg.backend === 'webgpu' ? 'WebGPU' : 'CPU / WASM'})`,
          })
          break
        case 'encode_ready':
          setIsEncoding(false)
          setIsEmbeddingReady(true)
          onStatusChangeRef.current?.('Embedding ready — click on the image to segment!')
          break
        case 'decode_result': {
          const maskData: MaskData = {
            mask: msg.mask,
            scores: msg.scores,
            bestIndex: msg.bestIndex,
            numMasks: msg.numMasks,
          }
          setIsDecoding(false)
          onMaskResultRef.current?.(maskData)
          onStatusChangeRef.current?.(`Segment score: ${(msg.scores[msg.bestIndex] as number).toFixed(3)}`)
          break
        }
        case 'error':
          setPartial({ statusMessage: `Error: ${msg.error}` })
          setIsEncoding(false)
          setIsDecoding(false)
          onStatusChangeRef.current?.(`Error: ${msg.error}`)
          break
      }
    }

    worker.onerror = (err) => {
      setPartial({ status: 'error', error: err.message, statusMessage: 'Worker error' })
    }

    return () => worker.terminate()
  }, [setPartial])

  const loadModel = useCallback(() => {
    setState(prev => {
      if (prev.status === 'loading' || prev.status === 'ready') return prev
      workerRef.current?.postMessage({ type: 'load_model' })
      return { ...prev, status: 'loading', progress: 0, error: null }
    })
  }, [])

  const encodeImage = useCallback((url: string) => {
    if (!workerRef.current) return
    setIsEncoding(true)
    setIsEmbeddingReady(false)
    workerRef.current.postMessage({ type: 'encode_image', url })
  }, [])

  const decode = useCallback((points: SegmentationPoint[]) => {
    if (!workerRef.current || isDecoding || points.length === 0) return
    setIsDecoding(true)
    workerRef.current.postMessage({ type: 'decode', points })
  }, [isDecoding])

  const setOnMaskResult = useCallback((cb: ((mask: MaskData) => void) | null) => {
    onMaskResultRef.current = cb
  }, [])

  const setOnStatusChange = useCallback((cb: ((msg: string) => void) | null) => {
    onStatusChangeRef.current = cb
  }, [])

  return {
    state,
    isEncoding,
    isDecoding,
    isEmbeddingReady,
    loadModel,
    encodeImage,
    decode,
    onMaskResult: onMaskResultRef.current,
    setOnMaskResult,
    setOnStatusChange,
  }
}