import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1e2e',
          borderRadius: '6px',
        }}
      >
        {/* Central column */}
        <div
          style={{
            position: 'absolute',
            left: '14px',
            top: '8px',
            width: '4px',
            height: '16px',
            backgroundColor: '#8B5CF6',
            borderRadius: '1px',
          }}
        />

        {/* Left column */}
        <div
          style={{
            position: 'absolute',
            left: '8px',
            top: '11px',
            width: '3px',
            height: '10px',
            backgroundColor: '#6366F1',
            opacity: 0.8,
            borderRadius: '1px',
          }}
        />

        {/* Right column */}
        <div
          style={{
            position: 'absolute',
            left: '21px',
            top: '11px',
            width: '3px',
            height: '10px',
            backgroundColor: '#6366F1',
            opacity: 0.8,
            borderRadius: '1px',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
