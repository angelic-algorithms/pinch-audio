import { useRef, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import * as tf from "@tensorflow/tfjs"
import * as handpose from "@tensorflow-models/handpose"
import "@tensorflow/tfjs-backend-webgl"
import { calculateDistance } from "@/lib/gesture-utils"

interface HandGestureControllerProps {
  onGestureUpdate: (volume: number, speed: number, pitch: number) => void
  initialValues: {
    volume: number
    speed: number
    pitch: number
  }
}

export default function HandGestureController({ onGestureUpdate, initialValues }: HandGestureControllerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [model, setModel] = useState<handpose.HandPose | null>(null)
  const [leftHandPinch, setLeftHandPinch] = useState(0)
  const [rightHandPinch, setRightHandPinch] = useState(0)
  const [handDistance, setHandDistance] = useState(0)
  const [handsDetected, setHandsDetected] = useState(false)
  const requestRef = useRef<number | null>(null)
  const noHandsFrameCount = useRef(0)

  // Keep track of current values for smoother updates
  const currentValues = useRef({
    volume: initialValues.volume,
    speed: initialValues.speed,
    pitch: initialValues.pitch,
  })

  // Load the handpose model
  useEffect(() => {
    async function loadModel() {
      await tf.ready()
      const loadedModel = await handpose.load()
      setModel(loadedModel)
      console.log("Handpose model loaded")
    }
    loadModel()

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [])

  // Set up webcam
  useEffect(() => {
    async function setupCamera() {
      if (!videoRef.current) return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user",
          },
        })
        videoRef.current.srcObject = stream
      } catch (error) {
        console.error("Error accessing webcam:", error)
      }
    }

    setupCamera()

    return () => {
      // Clean up video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        const tracks = stream.getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  // Update current values when initialValues change
  useEffect(() => {
    currentValues.current = {
      volume: initialValues.volume,
      speed: initialValues.speed,
      pitch: initialValues.pitch,
    }
  }, [initialValues])

  // Detect hands and process gestures
  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let leftHand: any = null
    let rightHand: any = null

    async function detectHands() {
      if (video.readyState !== 4 || !model) {
        requestRef.current = requestAnimationFrame(detectHands)
        return
      }

      // Get hand predictions
      const predictions = await model.estimateHands(video)

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw mirrored video frame
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.restore()

      // Update hands detected state
      if (predictions.length > 0) {
        setHandsDetected(true)
        noHandsFrameCount.current = 0
      } else {
        // Only set handsDetected to false after several frames without hands
        // to prevent flickering of instructions
        noHandsFrameCount.current += 1
        if (noHandsFrameCount.current > 30) {
          // About 0.5 seconds at 60fps
          setHandsDetected(false)
        }
      }

      // Process predictions
      if (predictions.length > 0) {
        // Reset hands for this frame
        leftHand = null
        rightHand = null

        // Mirror and process each hand prediction
        predictions.forEach((hand) => {
          // Create a mirrored version of the hand prediction
          const mirroredHand = mirrorHandPrediction(hand, canvas.width)

          // Identify hands based on position in frame
          const handX =
            mirroredHand.boundingBox.topLeft[0] +
            (mirroredHand.boundingBox.bottomRight[0] - mirroredHand.boundingBox.topLeft[0]) / 2

          // Assign to left or right based on position in mirrored view
          if (handX < canvas.width / 2) {
            leftHand = mirroredHand
          } else {
            rightHand = mirroredHand
          }
        })

        // Process left hand (speed)
        if (leftHand) {
          const landmarks = leftHand.landmarks
          const thumbTip = landmarks[4]
          const indexTip = landmarks[8]

          // Calculate pinch distance
          const pinchDistance = calculateDistance(thumbTip, indexTip)
          const normalizedPinch = Math.min(Math.max(1 - pinchDistance / 100, 0), 1)
          setLeftHandPinch(normalizedPinch)

          // Draw left hand indicators
          drawHand(ctx, landmarks, "blue")
          drawPinchLine(ctx, thumbTip, indexTip, "blue")

          // Draw speed label
          const speed = 0.5 + normalizedPinch * 3.5 // 0.5x to 4.0x
          drawLabel(ctx, thumbTip[0] - 40, thumbTip[1] - 20, `SPEED ${speed.toFixed(1)}x`, "blue")

          // Update current speed value
          currentValues.current.speed = speed
        }

        // Process right hand (pitch)
        if (rightHand) {
          const landmarks = rightHand.landmarks
          const thumbTip = landmarks[4]
          const indexTip = landmarks[8]

          // Calculate pinch distance
          const pinchDistance = calculateDistance(thumbTip, indexTip)
          const normalizedPinch = Math.min(Math.max(1 - pinchDistance / 100, 0), 1)
          setRightHandPinch(normalizedPinch)

          // Draw right hand indicators
          drawHand(ctx, landmarks, "red")
          drawPinchLine(ctx, thumbTip, indexTip, "red")

          // Draw pitch label
          const pitch = 0.5 + normalizedPinch * 3.5 // 0.5 to 4.0 (will be multiplied by 100 for Hz)
          drawLabel(ctx, thumbTip[0] - 40, thumbTip[1] - 20, `PITCH ${Math.round(pitch * 100)}Hz`, "red")

          // Update current pitch value
          currentValues.current.pitch = pitch
        }

        // Calculate distance between hands for volume
        if (leftHand && rightHand) {
          const leftPalmBase = leftHand.landmarks[0]
          const rightPalmBase = rightHand.landmarks[0]

          const distance = calculateDistance(leftPalmBase, rightPalmBase)
          const normalizedDistance = Math.min(Math.max(distance / 400, 0), 1)
          setHandDistance(normalizedDistance)

          // Draw volume visualization
          drawVolumeVisualization(ctx, leftPalmBase, rightPalmBase, normalizedDistance)

          // Draw volume label in the center of the screen
          const volume = normalizedDistance
          drawCenteredVolumeLabel(ctx, volume)

          // Update current volume value
          currentValues.current.volume = volume
        }

        // Update controls based on gestures
        updateControls()
      }

      // Continue detection loop
      requestRef.current = requestAnimationFrame(detectHands)
    }

    // Function to mirror hand prediction coordinates
    function mirrorHandPrediction(hand: any, canvasWidth: number) {
      // Create a deep copy of the hand prediction
      const mirroredHand = JSON.parse(JSON.stringify(hand))

      // Mirror the bounding box coordinates
      mirroredHand.boundingBox.topLeft[0] = canvasWidth - hand.boundingBox.topLeft[0]
      mirroredHand.boundingBox.bottomRight[0] = canvasWidth - hand.boundingBox.bottomRight[0]

      // Swap the x-coordinates to maintain correct orientation
      const temp = mirroredHand.boundingBox.topLeft[0]
      mirroredHand.boundingBox.topLeft[0] = mirroredHand.boundingBox.bottomRight[0]
      mirroredHand.boundingBox.bottomRight[0] = temp

      // Mirror all landmark coordinates
      mirroredHand.landmarks = hand.landmarks.map((landmark: number[]) => {
        return [canvasWidth - landmark[0], landmark[1], landmark[2]]
      })

      // Mirror the annotations if they exist
      if (hand.annotations) {
        mirroredHand.annotations = {}
        for (const key in hand.annotations) {
          mirroredHand.annotations[key] = hand.annotations[key].map((point: number[]) => {
            return [canvasWidth - point[0], point[1], point[2]]
          })
        }
      }

      return mirroredHand
    }

    function updateControls() {
      // Send updates to parent component with current values
      onGestureUpdate(currentValues.current.volume, currentValues.current.speed, currentValues.current.pitch)
    }

    function drawHand(ctx: CanvasRenderingContext2D, landmarks: any[], color: string) {
      // Draw hand landmarks
      for (let i = 0; i < landmarks.length; i++) {
        const [x, y] = landmarks[i]
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()
      }

      // Draw connections
      const connections = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4], // thumb
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8], // index finger
        [0, 9],
        [9, 10],
        [10, 11],
        [11, 12], // middle finger
        [0, 13],
        [13, 14],
        [14, 15],
        [15, 16], // ring finger
        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20], // pinky
        [0, 5],
        [5, 9],
        [9, 13],
        [13, 17], // palm
      ]

      for (const [i, j] of connections) {
        const [xi, yi] = landmarks[i]
        const [xj, yj] = landmarks[j]

        ctx.beginPath()
        ctx.moveTo(xi, yi)
        ctx.lineTo(xj, yj)
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    function drawPinchLine(ctx: CanvasRenderingContext2D, point1: number[], point2: number[], color: string) {
      ctx.beginPath()
      ctx.moveTo(point1[0], point1[1])
      ctx.lineTo(point2[0], point2[1])
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.stroke()
    }

    function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
      // Draw background with better contrast
      ctx.font = "bold 16px Arial"
      const textWidth = ctx.measureText(text).width

      // Draw background with rounded corners
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
      roundRect(ctx, x - 5, y - 20, textWidth + 10, 26, 4, true, false)

      // Draw text with shadow for better legibility
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      ctx.fillStyle = color
      ctx.fillText(text, x, y)

      // Reset shadow
      ctx.shadowColor = "transparent"
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }

    function drawVolumeVisualization(
      ctx: CanvasRenderingContext2D,
      leftPoint: number[],
      rightPoint: number[],
      volume: number,
    ) {
      // Draw line connecting hands
      const gradient = ctx.createLinearGradient(leftPoint[0], leftPoint[1], rightPoint[0], rightPoint[1])
      gradient.addColorStop(0, "blue")
      gradient.addColorStop(0.5, "green")
      gradient.addColorStop(1, "red")

      ctx.beginPath()
      ctx.moveTo(leftPoint[0], leftPoint[1])
      ctx.lineTo(rightPoint[0], rightPoint[1])
      ctx.strokeStyle = gradient
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])

      // Draw colored bars visualization (similar to the reference image)
      const centerX = (leftPoint[0] + rightPoint[0]) / 2
      const centerY = (leftPoint[1] + rightPoint[1]) / 2
      const barCount = 20
      const barWidth = 6
      const barSpacing = 3
      const totalWidth = barCount * (barWidth + barSpacing)
      const startX = centerX - totalWidth / 2

      // Calculate how many bars to fill based on volume
      const filledBars = Math.round(volume * barCount)

      for (let i = 0; i < barCount; i++) {
        const barX = startX + i * (barWidth + barSpacing)
        const barHeight = 30 + (i % 3) * 10 // Varied heights
        const barY = centerY - 50 // Position above the center line

        // Create color gradient from blue to red
        let barColor
        if (i < barCount / 3) {
          barColor = "blue"
        } else if (i < (barCount * 2) / 3) {
          barColor = "green"
        } else {
          barColor = "red"
        }

        // Draw bar outline
        ctx.beginPath()
        ctx.rect(barX, barY, barWidth, barHeight)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
        ctx.lineWidth = 1
        ctx.stroke()

        // Fill bar if it's within the volume range
        if (i < filledBars) {
          ctx.fillStyle = barColor
          ctx.fillRect(barX, barY, barWidth, barHeight)
        }
      }
    }

    function drawCenteredVolumeLabel(ctx: CanvasRenderingContext2D, volume: number) {
      const centerX = canvas.width / 2
      const centerY = canvas.height / 3

      // Draw semi-transparent background for better text visibility
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
      roundRect(ctx, centerX - 120, centerY - 60, 240, 130, 10, true, false)

      // Draw volume text
      ctx.font = "bold 32px Arial"
      ctx.textAlign = "center"
      ctx.fillStyle = "white"
      ctx.fillText("VOLUME", centerX, centerY - 20)

      // Draw volume value
      ctx.font = "bold 48px Arial"
      ctx.fillText((volume * 10).toFixed(1), centerX, centerY + 30)

      // Draw horizontal volume bar
      const barWidth = 200
      const barHeight = 10
      const barX = centerX - barWidth / 2
      const barY = centerY + 50

      // Background bar
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
      ctx.fillRect(barX, barY, barWidth, barHeight)

      // Filled portion
      const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY)
      gradient.addColorStop(0, "blue")
      gradient.addColorStop(0.5, "green")
      gradient.addColorStop(1, "red")

      ctx.fillStyle = gradient
      ctx.fillRect(barX, barY, barWidth * volume, barHeight)
    }

    // Helper function to draw rounded rectangles
    function roundRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
      fill: boolean,
      stroke: boolean,
    ) {
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + width - radius, y)
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
      ctx.lineTo(x + width, y + height - radius)
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
      ctx.lineTo(x + radius, y + height)
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      if (fill) {
        ctx.fill()
      }
      if (stroke) {
        ctx.stroke()
      }
    }

    // Start detection loop
    detectHands()

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [model, initialValues, onGestureUpdate])

  return (
    <Card className="p-0 overflow-hidden bg-gray-800 border-gray-700 relative">
      <video ref={videoRef} className="w-full h-full object-cover hidden" autoPlay playsInline />
      <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover" />

      {!handsDetected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/80 p-6 rounded-xl max-w-md text-center">
            <h3 className="text-xl font-bold mb-4 text-white">Gesture Controls</h3>
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mb-2">
                  <span className="text-white font-bold">L</span>
                </div>
                <p className="text-white font-medium">Left Hand: Speed</p>
                <p className="text-gray-300 text-sm">Pinch to adjust</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center mb-2">
                  <span className="text-white font-bold">R</span>
                </div>
                <p className="text-white font-medium">Right Hand: Pitch</p>
                <p className="text-gray-300 text-sm">Pinch to adjust</p>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-full h-2 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 rounded-full mb-2"></div>
              <p className="text-white font-medium">Hand Distance: Volume</p>
              <p className="text-gray-300 text-sm">Move hands apart to increase</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

