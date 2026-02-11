"use client";

import React from "react";

interface PageLoaderProps {
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  message = "Loading...",
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <style>
        {`
          @keyframes gradient-shift {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes glow-pulse {
            0%, 100% {
              box-shadow: 0 0 20px rgba(255, 112, 91, 0.4), 0 0 40px rgba(255, 180, 87, 0.2);
            }
            50% {
              box-shadow: 0 0 30px rgba(255, 112, 91, 0.6), 0 0 60px rgba(255, 180, 87, 0.4);
            }
          }
          .animate-gradient-shift {
            animation: gradient-shift 3s ease infinite;
            background-size: 200% auto;
          }
          .animate-glow-pulse {
            animation: glow-pulse 2s ease-in-out infinite;
          }
        `}
      </style>
      <div className="flex flex-col items-center gap-6">
        {/* Animated Logo/Icon */}
        <div className="relative w-24 h-24">
          {/* Outer pulsing ring - warm gradient */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-rose-500/20 animate-pulse" />

          {/* Middle rotating ring - warm colors */}
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-orange-500 border-r-amber-500 animate-spin" />

          {/* Inner pulsing core - warm gradient with glow */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500 animate-pulse animate-glow-pulse" />

          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-background animate-pulse" />
          </div>
        </div>

        {/* Loading text with warm gradient */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 animate-gradient-shift">
            CoinRisqLab
          </h2>
          <p className="text-sm text-default-500 animate-pulse">{message}</p>
        </div>

        {/* Loading dots - warm colors */}
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
};
