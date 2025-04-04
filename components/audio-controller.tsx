"use client"

import { useState, useEffect, useRef } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Play, Pause, Sliders } from "lucide-react"
import HandGestureController from "./hand-gesture-controller"
import AudioVisualizer from "./audio-visualizer"
import DropZone from "./drop-zone"

export default function AudioController() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [mix, setMix] = useState(100)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showWebcam, setShowWebcam] = useState(false)
  const [gestureControlEnabled, setGestureControlEnabled] = useState(false)
  const [fileName, setFileName] = useState<string>("")
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const pitchProcessorRef = useRef<any>(null)

  useEffect(() => {
    // Initialize audio context and related nodes
    if (typeof window !== "undefined" && !audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioContext()
  
      const audioElement = new Audio()
      audioElement.crossOrigin = "anonymous"
      audioElementRef.current = audioElement
  
      const gainNode = audioContextRef.current.createGain()
      gainNodeRef.current = gainNode
      gainNode.connect(audioContextRef.current.destination)
  
      audioElement.addEventListener("ended", () => setIsPlaying(false))
      audioElement.addEventListener("canplay", () => {
        console.log("canplay event fired")
        setIsLoaded(true)
      })
    }
  
    return () => {
      // Cleanup audio element
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.src = ""
      }
  
      // Clean up object URL
      if (audioObjectUrl) {
        URL.revokeObjectURL(audioObjectUrl)
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

  useEffect(() => {
    if (pitchProcessorRef.current && audioContextRef.current) {
      const pitchParam = pitchProcessorRef.current.parameters.get('pitch');
      pitchParam.setValueAtTime(pitch, audioContextRef.current.currentTime);
    }
  }, [pitch])
  
  useEffect(() => {
    if (pitchProcessorRef.current && audioContextRef.current) {
      const mixParam = pitchProcessorRef.current.parameters.get('mix');
      mixParam.setValueAtTime(mix, audioContextRef.current.currentTime);
    }
  }, [mix]);

  // Handle file drop
  const handleFileDrop = (files: FileList) => {
    if (files.length > 0) {
      const file = files[0]

      // Check if it's an audio file
      if (file.type.startsWith("audio/")) {
        setAudioFile(file)
        setFileName(file.name)

        // Clean up previous object URL
        if (audioObjectUrl) {
          URL.revokeObjectURL(audioObjectUrl)
        }

        // Create new object URL
        const objectUrl = URL.createObjectURL(file)
        setAudioObjectUrl(objectUrl)

        // Load the audio
        loadAudio(objectUrl)
      } else {
        alert("Please upload an audio file (MP3, WAV, OGG, etc.)")
      }
    }
  }

  const loadAudio = async (audioSrc: string) => {
    if (!audioSrc || !audioContextRef.current) return;
  
    // Ensure the AudioContext is running
    if (audioContextRef.current.state !== "running") {
      await audioContextRef.current.resume();
    }
  
    // Reset previous connections
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }
  
    try {
      // Now that the AudioContext is resumed, add the worklet module
      await audioContextRef.current.audioWorklet.addModule('/pitch-shifter-processor.js');
    } catch (error) {
      console.error('Failed to load pitch shifter module', error);
      return;
    }
  
    // Create the pitch shifter node
    const pitchShifterNode = new AudioWorkletNode(audioContextRef.current, 'pitch-shifter-processor', {
      parameterData: { pitch: pitch, mix: mix }
    });
    pitchProcessorRef.current = pitchShifterNode;
    
    // Set audio source on the existing audio element
    audioElementRef.current!.src = audioSrc;
    audioElementRef.current!.load();
  
    // Create and connect source node
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioElementRef.current!);
  
    // Chain: source -> pitch shifter -> gain node -> destination
    sourceNodeRef.current.connect(gainNodeRef.current!);
    sourceNodeRef.current.connect(pitchShifterNode);
    const splitter = audioContextRef.current.createChannelSplitter(2);
    pitchShifterNode.connect(splitter);

      // Connect one branch to the gain node (for playback)
    splitter.connect(gainNodeRef.current!, 0);

    // Create an analyser node for visualization
    const analyserNode = audioContextRef.current.createAnalyser();
    analyserNode.fftSize = 256;
    // Connect the other branch to the analyser node
    splitter.connect(analyserNode, 0);

    // Save the analyser node (you can use state or a ref)
    setAnalyser(analyserNode); 

  
    setIsLoaded(true);
    console.log("Audio loaded with pitch shifter");
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
          <DropZone onFileDrop={handleFileDrop} />

          {fileName && (
            <div className="mt-2 text-sm text-gray-300">
              <span className="font-medium">Loaded file:</span> {fileName}
            </div>
          )}

          <div className="flex justify-between items-center mt-4">
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
                  max={100}
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

          {isPlaying && <AudioVisualizer analyser={analyser} />}
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

