import React, { useMemo } from 'react';

interface CharacterCounterProps {
  current: number;
  max: number;
  warningThreshold?: number;
}

export const CharacterCounter: React.FC<CharacterCounterProps> = ({
  current,
  max,
  warningThreshold = 0.9,
}) => {
  const state = useMemo(() => {
    const remaining = max - current;
    const isWarning = current > max * warningThreshold;
    const isError = current > max;

    return {
      remaining,
      isWarning,
      isError,
    };
  }, [current, max, warningThreshold]);

  return (
    <div
      id="description-counter"
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className={`text-sm ${
        state.isError
          ? 'text-red-600'
          : state.isWarning
            ? 'text-yellow-600'
            : 'text-gray-600'
      }`}
    >
      <span className="sr-only">
        {state.isError
          ? `Character limit exceeded. ${Math.abs(state.remaining)} characters over the limit.`
          : `${state.remaining} characters remaining out of ${max}.`}
      </span>
      {state.isWarning && !state.isError && (
        <span className="inline-flex items-center mr-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
      {state.isError && (
        <span className="inline-flex items-center mr-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
      <span aria-hidden="true">{state.remaining} characters remaining</span>
    </div>
  );
};
