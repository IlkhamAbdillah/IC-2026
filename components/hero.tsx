export default function Hero() {
  return (
    <div className="min-h-screen w-full flex flex-col gap-16 items-center justify-between relative overflow-hidden bg-gradient-to-b from-[#141c3a] via-[#1d2b55] to-[#253675]">
      {/* Animated particles or shapes */}
      <div className="absolute inset-0 z-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10 animate-float"
            style={{
              width: `${Math.random() * 100 + 50}px`,
              height: `${Math.random() * 100 + 50}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 10 + 10}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <div className="flex gap-8 justify-center items-center w-full z-10"></div>
      <div className="flex flex-col items-center gap-6 z-10">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white text-center animate-fadeIn">
          Selamat Datang! Silahkan{" "}
          <a
            href="/sign-in"
            className="inline-block px-4 sm:px-6 md:px-8 py-2 md:py-3 bg-white text-purple-900 font-semibold rounded-lg shadow-lg hover:bg-opacity-90 transition-all transform hover:scale-105"
          >
            sign-in
          </a>{" "}
          terlebih dahulu untuk melanjutkan
        </h1>
      </div>
      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/30 to-transparent z-10" />
    </div>
  );
}
