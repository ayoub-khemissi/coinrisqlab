"use client";

interface PresentationCardProps {
  width: number;
  height: number;
}

const CoinRisqLabLogo = ({ className }: { className?: string }) => {
  return (
    <div className={`font-bold ${className}`}>
      <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
        CoinRisq
      </span>
      <span className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 bg-clip-text text-transparent">
        Lab
      </span>
    </div>
  );
};

const PresentationCard = ({ width, height }: PresentationCardProps) => {
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-500/5 via-red-500/5 to-pink-500/5"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center space-y-8 p-12 text-center">
        {/* Logo with subtle glow effect */}
        <div className="transform transition-all duration-300 hover:scale-105">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 blur-lg" />
            <CoinRisqLabLogo className="relative text-6xl" />
          </div>
        </div>

        {/* Main Value Proposition */}
        <div className="space-y-4">
          <h1 className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-4xl font-extrabold leading-tight text-transparent">
            Real-time crypto market intelligence
          </h1>
          <p className="text-lg font-medium text-default-600">
            Track top 80 cryptocurrencies with advanced risk analysis
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center space-x-2 rounded-full border-2 border-orange-500 bg-orange-500/10 px-4 py-2 shadow-md backdrop-blur-sm">
            <span className="text-lg">📊</span>
            <span className="text-sm font-bold text-orange-400">
              Live tracking
            </span>
          </div>

          <div className="flex items-center space-x-2 rounded-full border-2 border-red-500 bg-red-500/10 px-4 py-2 shadow-md backdrop-blur-sm">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-bold text-red-400">
              Real-time data
            </span>
          </div>

          <div className="flex items-center space-x-2 rounded-full border-2 border-pink-500 bg-pink-500/10 px-4 py-2 shadow-md backdrop-blur-sm">
            <span className="text-lg">🛡️</span>
            <span className="text-sm font-bold text-pink-400">
              Risk analysis
            </span>
          </div>

          <div className="flex items-center space-x-2 rounded-full border-2 border-rose-500 bg-rose-500/10 px-4 py-2 shadow-md backdrop-blur-sm">
            <span className="text-lg">📈</span>
            <span className="text-sm font-bold text-rose-400">
              Market insights
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationCard;
