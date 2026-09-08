import {
  WATCH_PARTY_ENCODE_STEPS,
  type WatchPartyEncodeStep
} from "@/lib/watch-party-types"

export type EncodeStepView = {
  step: WatchPartyEncodeStep
  label: string
  percent: number
  isActive: boolean
  isComplete: boolean
}

const STEP_LABELS: Record<WatchPartyEncodeStep, string> = {
  download: "Download",
  transcode: "Transcode",
  upload: "Upload"
}

export const encodeStepViews = (
  currentStep: WatchPartyEncodeStep | null,
  percent: number,
): EncodeStepView[] => {
  const activeStep = currentStep ?? "download"
  const activeIndex = WATCH_PARTY_ENCODE_STEPS.indexOf(activeStep)
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))

  return WATCH_PARTY_ENCODE_STEPS.map((step, index) => {
    if (index < activeIndex) {
      return {
        step,
        label: STEP_LABELS[step],
        percent: 100,
        isActive: false,
        isComplete: true
      }
    }
    if (index > activeIndex) {
      return {
        step,
        label: STEP_LABELS[step],
        percent: 0,
        isActive: false,
        isComplete: false
      }
    }
    return {
      step,
      label: STEP_LABELS[step],
      percent: clamped,
      isActive: clamped < 100,
      isComplete: clamped >= 100
    }
  })
}
