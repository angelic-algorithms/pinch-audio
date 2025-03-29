import AudioController from "@/components/audio-controller"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 bg-gray-900 text-white">
      <div className="w-full max-w-5xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center">Gesture-Controlled Audio Player</h1>
        <AudioController />
      </div>
    </main>
  )
}

