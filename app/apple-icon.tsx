import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

// Image generation - Apple touch icon (180x180)
export default function AppleIcon() {
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
          borderRadius: '32px',
        }}
      >
        {/* Central column - scaled up */}
        <div
          style={{
            position: 'absolute',
            left: '78px',
            top: '45px',
            width: '24px',
            height: '90px',
            backgroundColor: '#8B5CF6',
            borderRadius: '6px',
          }}
        />

        {/* Left column - scaled up */}
        <div
          style={{
            position: 'absolute',
            left: '45px',
            top: '62px',
            width: '18px',
            height: '56px',
            backgroundColor: '#6366F1',
            opacity: 0.8,
            borderRadius: '5px',
          }}
        />

        {/* Right column - scaled up */}
        <div
          style={{
            position: 'absolute',
            left: '117px',
            top: '62px',
            width: '18px',
            height: '56px',
            backgroundColor: '#6366F1',
            opacity: 0.8,
            borderRadius: '5px',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
