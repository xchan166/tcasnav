export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6">

      <div className="text-center">

        <h1 className="text-6xl font-extrabold mb-6 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          TCASNAV
        </h1>

        <p className="text-xl text-slate-300 mb-10 max-w-2xl">
          AI Navigation Platform for TCAS Preparation
        </p>

        <button className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-8 py-4 rounded-2xl text-lg transition duration-300 shadow-lg shadow-cyan-500/30">
          เริ่มวางแผนฟรี
        </button>

      </div>

    </main>
  );
}