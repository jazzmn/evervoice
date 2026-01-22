'use client';

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Toast, ToastProvider, ToastViewport, ToastClose, ToastAction } from './toast';

// Wrapper component to provide toast context
function ToastWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}

describe('Toast Component Styling', () => {
  it('renders default toast with dark background', () => {
    const { getByTestId } = render(
      <ToastWrapper>
        <Toast data-testid="toast-default">Default Toast</Toast>
      </ToastWrapper>
    );
    const toast = getByTestId('toast-default');
    expect(toast).toHaveClass('bg-zinc-950');
    expect(toast).toHaveClass('text-zinc-50');
    expect(toast).toHaveClass('border-zinc-800');
  });

  it('renders success toast with dark green background', () => {
    const { getByTestId } = render(
      <ToastWrapper>
        <Toast variant="success" data-testid="toast-success">Success Toast</Toast>
      </ToastWrapper>
    );
    const toast = getByTestId('toast-success');
    expect(toast).toHaveClass('bg-green-950');
    expect(toast).toHaveClass('text-green-100');
    expect(toast).toHaveClass('border-green-900');
  });

  it('renders destructive toast with dark red background', () => {
    const { getByTestId } = render(
      <ToastWrapper>
        <Toast variant="destructive" data-testid="toast-destructive">Destructive Toast</Toast>
      </ToastWrapper>
    );
    const toast = getByTestId('toast-destructive');
    expect(toast).toHaveClass('bg-red-900');
    expect(toast).toHaveClass('text-zinc-50');
    expect(toast).toHaveClass('border-red-900');
  });

  it('renders ToastClose with dark-first text colors', () => {
    const { getByRole } = render(
      <ToastWrapper>
        <Toast>
          <ToastClose />
        </Toast>
      </ToastWrapper>
    );
    const closeButton = getByRole('button');
    expect(closeButton).toHaveClass('text-zinc-50/50');
    expect(closeButton).toHaveClass('hover:text-zinc-50');
  });
});
