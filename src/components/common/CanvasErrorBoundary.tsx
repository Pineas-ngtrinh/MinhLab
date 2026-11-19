'use client';

import { Component, type ReactNode } from 'react';

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#090D12] text-[#A5ADB8] text-xs font-mono">
            <span>Thiết bị không hỗ trợ tăng tốc đồ họa WebGL.</span>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default CanvasErrorBoundary;
