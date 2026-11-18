import React, { useState } from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, className = '' }) => {
  const [imgErr, setImgErr] = useState(false);

  if (!imgErr) {
    return (
      <img
        src="/pwa-192x192.png"
        alt="Fit-Plat with Karam"
        width={size}
        height={size}
        onError={() => setImgErr(true)}
        style={{ width: size, height: size }}
        className={`rounded-xl object-cover shadow-sm shrink-0 ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rounded-xl shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="124" fill="url(#brandBg)" />
      <circle cx="256" cy="256" r="156" stroke="#ffffff" strokeWidth="22" strokeOpacity="0.88" />
      <path d="M154 274 C154 336, 200 374, 256 374 C312 374, 358 336, 358 274 Z" fill="#ffffff" />
      <path d="M256 134 C298 158, 326 196, 314 238 C302 254, 276 260, 256 244 C236 260, 210 254, 198 238 C186 196, 214 158, 256 134 Z" fill="#a7f3d0" />
    </svg>
  );
};
