import { useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null
}

export default function AudioVisualizer({ audioElement }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return

    // Set up audio context and analyzer
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    const analyser = audioContext.createAnalyser()
    analyserRef.current = analyser
    analyser.fftSize = 256

    // Connect audio element to analyzer
    const source = audioContext.createMediaElementSource(audioElement)
    sourceRef.current = source
    source.connect(analyser)
    analyser.connect(audioContext.destination)

    // Set up canvas
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Animation function
    const animate = () => {
      if (!analyser || !ctx) return

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw visualization
      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
        gradient.addColorStop(0, "#3b82f6") // blue-500
        gradient.addColorStop(0.5, "#10b981") // emerald-500
        gradient.addColorStop(1, "#ef4444") // red-500

        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    // Start animation
    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [audioElement])

  return (
    <Card className="p-4 bg-gray-800 border-gray-700">
      <h3 className="text-sm font-medium mb-2">Audio Visualization</h3>
      <canvas ref={canvasRef} width={500} height={100} className="w-full h-24 bg-gray-900 rounded" />
    </Card>
  )
}

