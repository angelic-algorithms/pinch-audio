import { useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"

interface AudioVisualizerProps {
  analyser: AnalyserNode | null
}

export default function AudioVisualizer({ analyser }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!analyser || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const animate = () => {
      if (!analyser || !ctx) return

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw bars
      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2

        // Create a gradient for the bar
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
        gradient.addColorStop(0, "#3b82f6")  // blue-500
        gradient.addColorStop(0.5, "#10b981")  // emerald-500
        gradient.addColorStop(1, "#ef4444")    // red-500

        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [analyser])

  return (
    <Card className="p-4 bg-gray-800 border-gray-700">
      <h3 className="text-sm font-medium mb-2">Audio Visualization</h3>
      <canvas ref={canvasRef} width={500} height={100} className="w-full h-24 bg-gray-900 rounded" />
    </Card>
  )
}
