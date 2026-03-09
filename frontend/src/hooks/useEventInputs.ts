import { useState } from 'react';
import { subtractTimeOffset, parseTimeOffsetMs } from '../utils';

type OnUpdate = (
  eventId: number,
  action: string,
  startDatetime?: string,
  endDatetime?: string,
  nextTime?: string,
) => void;

export function useEventInputs(eventId: number, onUpdate: OnUpdate) {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [nextInput, setNextInput] = useState('');

  function handleStart() {
    const startDate = startInput.trim() ? subtractTimeOffset(startInput) : new Date();
    onUpdate(eventId, 'start', startDate.toISOString());
    setStartInput('');
  }

  function handleEnd() {
    const startDate = startInput.trim() ? subtractTimeOffset(startInput).toISOString() : undefined;
    const endDate = endInput.trim() ? subtractTimeOffset(endInput) : new Date();
    const nextTime = nextInput.trim()
      ? new Date(Date.now() + parseTimeOffsetMs(nextInput)).toISOString()
      : undefined;
    onUpdate(eventId, 'end', startDate, endDate.toISOString(), nextTime);
    setStartInput('');
    setEndInput('');
    setNextInput('');
  }

  function handleNext() {
    if (nextInput.trim()) {
        const nextTime = new Date(Date.now() + parseTimeOffsetMs(nextInput)).toISOString();
        onUpdate(eventId, 'set_next', undefined, undefined, nextTime);
        setNextInput('');
    }
  }

  return {
    startInput, setStartInput,
    endInput, setEndInput,
    nextInput, setNextInput,
    handleEnd,
    handleStart,
    handleNext,
  };
}
