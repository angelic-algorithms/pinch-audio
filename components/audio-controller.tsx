"use client"

import { useState, useEffect, useRef } from "react"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Play, Pause, Music, Sliders } from "lucide-react"
import HandGestureController from "./hand-gesture-controller"
import AudioVisualizer from "./audio-visualizer"

export default function AudioController() {
  const [audioUrl, setAudioUrl] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showWebcam, setShowWebcam] = useState(false)
  const [gestureControlEnabled, setGestureControlEnabled] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const pitchProcessorRef = useRef<any>(null)

  useEffect(() => {
    // Initialize audio context
    if (typeof window !== "undefined" && !audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioContext()

      // Create audio element
      const audioElement = new Audio()
      audioElement.crossOrigin = "anonymous"
      audioElementRef.current = audioElement

      // Create gain node for volume control
      const gainNode = audioContextRef.current.createGain()
      gainNodeRef.current = gainNode
      gainNode.connect(audioContextRef.current.destination)

      // Set up event listeners
      audioElement.addEventListener("ended", () => setIsPlaying(false))
      audioElement.addEventListener("canplay", () => setIsLoaded(true))
    }

    return () => {
      // Cleanup
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.src = ""
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Handle volume changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
    }
  }, [volume])

  // Handle speed changes
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed
    }
  }, [speed])

  // Handle pitch changes (simplified - in a real app, you'd use a proper pitch shifter)
  useEffect(() => {
    if (pitchProcessorRef.current) {
      // This is a simplified representation - actual pitch shifting is more complex
      // and would require a proper audio worklet or library
      pitchProcessorRef.current.pitch = pitch
    }
  }, [pitch])

  const loadAudio = () => {
    if (!audioUrl) {
      alert("Please enter an audio URL")
      return
    }

    if (!audioElementRef.current || !audioContextRef.current) return

    // Reset previous connections
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
    }

    // Set audio source
    audioElementRef.current.src = audioUrl
    audioElementRef.current.load()

    // Create and connect source node
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioElementRef.current)

    // For a real app, you would insert a pitch shifter node here
    // This is simplified - just connecting directly to gain node
    sourceNodeRef.current.connect(gainNodeRef.current!)

    setIsLoaded(true)
    console.log("Audio loaded successfully")
  }

  const togglePlayback = () => {
    if (!audioElementRef.current || !isLoaded) return

    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume()
    }

    if (isPlaying) {
      audioElementRef.current.pause()
      console.log("Playback paused")
    } else {
      audioElementRef.current.play()
      console.log("Playback started")
    }

    setIsPlaying(!isPlaying)
  }

  const handleGestureUpdate = (newVolume: number, newSpeed: number, newPitch: number) => {
    if (gestureControlEnabled) {
      // Directly update the state values without thresholds
      setVolume(newVolume)
      setSpeed(newSpeed)
      setPitch(newPitch)
    }
  }

  const toggleGestureControl = () => {
    setShowWebcam(!showWebcam)
    setGestureControlEnabled(!gestureControlEnabled)

    if (!showWebcam) {
      console.log("Gesture control enabled")
    } else {
      console.log("Gesture control disabled")
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              type="text"
              placeholder="Enter audio URL"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={loadAudio} className="whitespace-nowrap">
              <Music className="mr-2 h-4 w-4" /> Load Audio
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <Button onClick={togglePlayback} disabled={!isLoaded} variant="outline" size="icon" className="h-12 w-12">
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>

            <Button
              onClick={toggleGestureControl}
              variant={gestureControlEnabled ? "default" : "outline"}
              className="ml-auto"
            >
              <Sliders className="mr-2 h-4 w-4" />
              {gestureControlEnabled ? "Disable" : "Enable"} Gesture Control
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <Card className="p-6 bg-gray-800 border-gray-700">
            <div className="space-y-6">
              {/* Volume Control */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Volume</label>
                  <span className="text-sm">{(volume * 10).toFixed(1)}</span>
                </div>
                <Slider
                  value={[volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(value) => setVolume(value[0] / 100)}
                  className="[&>span:first-child]:h-2 [&>span:first-child]:bg-gradient-to-r [&>span:first-child]:from-blue-500 [&>span:first-child]:to-red-500"
                />
                <div className="text-xs text-gray-400 text-center">Control with distance between hands</div>
              </div>

              {/* Speed Control */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Speed</label>
                  <span className="text-sm">{speed.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[speed * 50]}
                  min={25}
                  max={200}
                  step={5}
                  onValueChange={(value) => setSpeed(value[0] / 50)}
                  className="[&>span:first-child]:h-2 [&>span:first-child]:bg-blue-500"
                />
                <div className="text-xs text-gray-400 text-center">Control with left hand pinch (mirrored view)</div>
              </div>

              {/* Pitch Control */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Pitch</label>
                  <span className="text-sm">{(pitch * 100).toFixed(0)}Hz</span>
                </div>
                <Slider
                  value={[pitch * 50]}
                  min={25}
                  max={200}
                  step={5}
                  onValueChange={(value) => setPitch(value[0] / 50)}
                  className="[&>span:first-child]:h-2 [&>span:first-child]:bg-red-500"
                />
                <div className="text-xs text-gray-400 text-center">Control with right hand pinch (mirrored view)</div>
              </div>
            </div>
          </Card>

          {isPlaying && <AudioVisualizer audioElement={audioElementRef.current} />}
        </div>

        <div className="flex flex-col">
          {showWebcam && (
            <HandGestureController onGestureUpdate={handleGestureUpdate} initialValues={{ volume, speed, pitch }} />
          )}

          {!showWebcam && (
            <Card className="p-6 bg-gray-800 border-gray-700 h-full flex items-center justify-center">
              <div className="text-center">
                <p className="mb-4">Enable gesture control to use hand movements</p>
                <Button onClick={toggleGestureControl}>
                  <Sliders className="mr-2 h-4 w-4" />
                  Enable Webcam
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

