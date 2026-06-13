export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-6xl mb-4">⚽</div>
      <h1 className="font-display text-5xl text-white tracking-widest mb-2">OUT OF BOUNDS</h1>
      <p className="text-white/40 mb-8">That page doesn't exist.</p>
      <a
        href="/"
        className="bg-amber-500 hover:bg-amber-400 text-pitch-dark font-semibold
                   px-8 py-3 rounded-xl transition-colors font-display text-xl tracking-widest"
      >
        GO HOME
      </a>
    </main>
  )
}
