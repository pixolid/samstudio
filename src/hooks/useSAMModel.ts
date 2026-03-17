import { useState, useCallback, useRef } from 'react'
import type { ModelState, BackendType } from '@/types/sam'
import type { ProgressInfo } from '@huggingface/transformers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = any

interface SAMModelHandle {
  model: AnyModel | null
  processor: AnyModel | null
  state: ModelState
  loadModel: () => Promise<void>
}

// sam2-hiera-tiny is purpose-built for single-image segmentation.
// sam3-tracker-ONNX was a video tracking model — far too heavy for this use case.
const MODEL_ID = 'onnx-community/sam2-hiera-tiny-ONNX'
const DTYPE_CONFIG = {
  vision_encoder: 'q4' as const,
  prompt_encoder_mask_decoder: 'q8' as const,
}

export function useSAMModel(): SAMModelHandle {
  const modelRef = useRef<AnyModel>(null)
  const processorRef = useRef<AnyModel>(null)

  const [state, setState] = useState<ModelState>({
    status: 'idle',
    backend: null,
    progress: 0,
    statusMessage: 'Ready to load model',
    error: null,
  })

  const setPartialState = (partial: Partial<ModelState>) =>
    setState((prev) => ({ ...prev, ...partial }))

  const loadModel = useCallback(async () => {
    if (state.status === 'loading' || state.status === 'ready') return

    setPartialState({ status: 'loading', progress: 0, error: null })

    // Dynamic import to avoid loading the large library until needed
    const { Sam2Model, AutoProcessor } = await import('@huggingface/transformers')

    const progressCallback = (p: ProgressInfo) => {
      if ('progress' in p && typeof p.progress === 'number') {
        setPartialState({ progress: Math.round(p.progress) })
      }
    }

    // ── Attempt 1: WebGPU ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((navigator as any).gpu) {
      try {
        setPartialState({ statusMessage: 'Loading SAM 2 model with WebGPU (GPU accelerated)…' })

        const m = await Sam2Model.from_pretrained(MODEL_ID, {
          dtype: DTYPE_CONFIG,
          device: 'webgpu',
          progress_callback: progressCallback,
        })
        const p = await AutoProcessor.from_pretrained(MODEL_ID)

        modelRef.current = m
        processorRef.current = p
        setPartialState({
          status: 'ready',
          backend: 'webgpu' as BackendType,
          progress: 100,
          statusMessage: 'SAM 2 ready (WebGPU)',
        })
        return
      } catch (err) {
        console.warn('[SAM Studio] WebGPU backend failed, falling back to WASM:', err)
        setPartialState({ progress: 0 })
      }
    }

    // ── Attempt 2: WASM / CPU ─────────────────────────────────────────────
    try {
      setPartialState({ statusMessage: 'Loading SAM 2 model with CPU (WASM)…' })

      const m = await Sam2Model.from_pretrained(MODEL_ID, {
        dtype: DTYPE_CONFIG,
        device: 'wasm',
        progress_callback: progressCallback,
      })
      const p = await AutoProcessor.from_pretrained(MODEL_ID)

      modelRef.current = m
      processorRef.current = p
      setPartialState({
        status: 'ready',
        backend: 'wasm' as BackendType,
        progress: 100,
        statusMessage: 'SAM 2 ready (CPU / WASM)',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPartialState({
        status: 'error',
        error: msg,
        statusMessage: 'Failed to load model',
      })
    }
  }, [state.status])

  return {
    model: modelRef.current,
    processor: processorRef.current,
    state,
    loadModel,
  }
}
