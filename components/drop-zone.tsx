"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, Music } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DropZoneProps {
  onFileDrop: (files: FileList) => void
}

export default function DropZone({ onFileDrop }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files)
    }
  }

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
        isDragging ? "border-blue-500 bg-blue-500/10" : "border-gray-600 hover:border-gray-500"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-3 rounded-full bg-gray-700">
          <Upload className="h-6 w-6 text-gray-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Drag and drop your audio file here</p>
          <p className="text-xs text-gray-400 mt-1">Supports MP3, WAV, OGG, and more</p>
        </div>
        <div className="flex items-center text-sm text-gray-400">
          <span className="mx-2">or</span>
        </div>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileInputChange} />
        <Button onClick={handleButtonClick} variant="outline" className="flex items-center">
          <Music className="mr-2 h-4 w-4" />
          Browse Audio Files
        </Button>
      </div>
    </div>
  )
}

