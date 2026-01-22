import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { WaveformCanvas } from './waveform-canvas';

// Mock AudioContext and related Web Audio API
const mockGetByteTimeDomainData = vi.fn();
const mockAnalyserConnect = vi.fn();
const mockAnalyserDisconnect = vi.fn();
const mockSourceConnect = vi.fn();
const mockSourceDisconnect = vi.fn();
const mockContextClose = vi.fn();

const createMockAnalyserNode = () => ({
  fftSize: 2048,
  frequencyBinCount: 1024,
  smoothingTimeConstant: 0.8,
  getByteTimeDomainData: mockGetByteTimeDomainData,
  connect: mockAnalyserConnect,
  disconnect: mockAnalyserDisconnect,
});

const createMockSourceNode = () => ({
  connect: mockSourceConnect,
  disconnect: mockSourceDisconnect,
});

// Create a class-based mock for AudioContext
class MockAudioContext {
  createAnalyser = vi.fn(createMockAnalyserNode);
  createMediaStreamSource = vi.fn(createMockSourceNode);
  close = mockContextClose;
}

// Mock requestAnimationFrame and cancelAnimationFrame
let rafCallbacks: Array<{ id: number; callback: FrameRequestCallback }> = [];
let rafId = 0;

const mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  rafId++;
  rafCallbacks.push({ id: rafId, callback });
  return rafId;
});

const mockCancelAnimationFrame = vi.fn((id: number) => {
  rafCallbacks = rafCallbacks.filter((cb) => cb.id !== id);
});

// Helper to run animation frame
function runAnimationFrame(timestamp = 0) {
  const callbacks = [...rafCallbacks];
  rafCallbacks = [];
  callbacks.forEach(({ callback }) => callback(timestamp));
}

// Mock canvas context
const mockCanvasContext = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  scale: vi.fn(),
};

// Create a mock MediaStream
function createMockMediaStream(): MediaStream {
  return {
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
    active: true,
    id: 'mock-stream-id',
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onaddtrack: null,
    onremovetrack: null,
  } as unknown as MediaStream;
}

describe('WaveformCanvas', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    rafCallbacks = [];
    rafId = 0;

    // Mock global AudioContext with class-based mock
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('requestAnimationFrame', mockRequestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', mockCancelAnimationFrame);
    mockContextClose.mockResolvedValue(undefined);

    // Reset mock canvas context functions
    mockCanvasContext.fillRect.mockClear();
    mockCanvasContext.beginPath.mockClear();
    mockCanvasContext.moveTo.mockClear();
    mockCanvasContext.lineTo.mockClear();
    mockCanvasContext.stroke.mockClear();
    mockCanvasContext.scale.mockClear();

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => mockCanvasContext
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 80,
      top: 0,
      left: 0,
      bottom: 80,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    // Reset device pixel ratio
    vi.stubGlobal('devicePixelRatio', 1);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('Canvas Rendering', () => {
    it('should render canvas at correct dimensions with responsive container', () => {
      render(<WaveformCanvas mediaStream={null} state="idle" height={80} />);

      const container = screen.getByTestId('waveform-container');
      const canvas = screen.getByTestId('waveform-canvas');

      expect(container).toBeInTheDocument();
      expect(canvas).toBeInTheDocument();
      expect(container).toHaveStyle({ height: '80px' });
    });

    it('should apply custom height when provided', () => {
      render(<WaveformCanvas mediaStream={null} state="idle" height={120} />);

      const container = screen.getByTestId('waveform-container');
      expect(container).toHaveStyle({ height: '120px' });
    });

    it('should apply custom className to container', () => {
      render(
        <WaveformCanvas mediaStream={null} state="idle" className="custom-class" />
      );

      const container = screen.getByTestId('waveform-container');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Waveform Drawing During Recording', () => {
    it('should start animation and draw waveform when recording with mediaStream', async () => {
      const mockStream = createMockMediaStream();

      // Set up time domain data to return
      mockGetByteTimeDomainData.mockImplementation((arr: Uint8Array) => {
        // Fill with sample waveform data (sine-like pattern)
        for (let i = 0; i < arr.length; i++) {
          arr[i] = 128 + Math.floor(50 * Math.sin(i * 0.1));
        }
      });

      render(
        <WaveformCanvas mediaStream={mockStream} state="recording" height={80} />
      );

      // Wait for effects to run
      await act(async () => {
        await Promise.resolve();
      });

      // Verify requestAnimationFrame was called (animation started)
      expect(mockRequestAnimationFrame).toHaveBeenCalled();

      // Run animation frames to trigger drawing
      await act(async () => {
        runAnimationFrame(0);
        runAnimationFrame(100); // After frame interval
      });

      // Verify drawing methods were called
      expect(mockCanvasContext.beginPath).toHaveBeenCalled();
      expect(mockCanvasContext.stroke).toHaveBeenCalled();
    });
  });

  describe('Paused State Visualization', () => {
    it('should stop animation and flatten waveform when paused', async () => {
      const mockStream = createMockMediaStream();

      const { rerender } = render(
        <WaveformCanvas mediaStream={mockStream} state="recording" height={80} />
      );

      // Wait for recording state to initialize
      await act(async () => {
        await Promise.resolve();
      });

      // Record the number of requestAnimationFrame calls during recording
      const rafCallsDuringRecording = mockRequestAnimationFrame.mock.calls.length;
      expect(rafCallsDuringRecording).toBeGreaterThan(0);

      // Change to paused state
      rerender(
        <WaveformCanvas mediaStream={mockStream} state="paused" height={80} />
      );

      await act(async () => {
        await Promise.resolve();
      });

      // Verify cancelAnimationFrame was called to stop animation
      expect(mockCancelAnimationFrame).toHaveBeenCalled();

      // Verify flat line is drawn (beginPath + moveTo + lineTo + stroke pattern)
      expect(mockCanvasContext.beginPath).toHaveBeenCalled();
      expect(mockCanvasContext.moveTo).toHaveBeenCalled();
      expect(mockCanvasContext.lineTo).toHaveBeenCalled();
      expect(mockCanvasContext.stroke).toHaveBeenCalled();
    });
  });

  describe('Cleanup on Unmount', () => {
    it('should cancel AnimationFrame and disconnect analyzer on unmount', async () => {
      const mockStream = createMockMediaStream();

      const { unmount } = render(
        <WaveformCanvas mediaStream={mockStream} state="recording" height={80} />
      );

      // Wait for component to initialize
      await act(async () => {
        await Promise.resolve();
      });

      // Unmount the component
      unmount();

      // Verify cleanup was performed
      expect(mockCancelAnimationFrame).toHaveBeenCalled();
      expect(mockContextClose).toHaveBeenCalled();
    });

    it('should handle unmount when no mediaStream is provided', () => {
      const { unmount } = render(
        <WaveformCanvas mediaStream={null} state="idle" height={80} />
      );

      // Should not throw when unmounting without active stream
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      render(<WaveformCanvas mediaStream={null} state="idle" height={80} />);

      const canvas = screen.getByTestId('waveform-canvas');
      expect(canvas).toHaveAttribute('aria-label', 'Audio waveform visualization');
      expect(canvas).toHaveAttribute('role', 'img');
    });
  });
});
