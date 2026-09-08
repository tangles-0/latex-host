import { describe, expect, it } from "vitest"

import { encodeStepViews } from "@/lib/watch-party-encode-progress"

describe("encodeStepViews", () => {
  it("marks earlier steps complete while download is running", () => {
    expect(encodeStepViews("download", 42)).toEqual([
      {
        step: "download",
        label: "Download",
        percent: 42,
        isActive: true,
        isComplete: false
      },
      {
        step: "transcode",
        label: "Transcode",
        percent: 0,
        isActive: false,
        isComplete: false
      },
      {
        step: "upload",
        label: "Upload",
        percent: 0,
        isActive: false,
        isComplete: false
      }
    ])
  })

  it("treats a finished current step as complete", () => {
    const [download, transcode] = encodeStepViews("transcode", 100)
    expect(download).toMatchObject({ isComplete: true, percent: 100 })
    expect(transcode).toMatchObject({ isComplete: true, isActive: false, percent: 100 })
  })

  it("defaults a missing step to download", () => {
    expect(encodeStepViews(null, 0)[0]).toMatchObject({
      step: "download",
      isActive: true,
      percent: 0
    })
  })
})
