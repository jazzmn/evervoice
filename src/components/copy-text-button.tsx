'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Props for the CopyTextButton component
 */
export interface CopyTextButtonProps {
  /** The transcription text to copy */
  transcription: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Button component that copies the raw transcription text to clipboard.
 *
 * - Copies transcription directly to clipboard
 * - Shows brief success state with checkmark
 * - Displays toast notification on success
 */
export function CopyTextButton({
  transcription,
  disabled = false,
  className,
}: CopyTextButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!transcription || isCopied) return;

    try {
      await navigator.clipboard.writeText(transcription);

      setIsCopied(true);
      toast({
        title: 'Text copied to clipboard',
        description: 'The transcription has been copied.',
        variant: 'success',
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy text to clipboard.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={disabled || !transcription}
      className={cn('gap-2', className)}
      data-testid="copy-text-button"
      aria-label={isCopied ? 'Text copied' : 'Copy transcription to clipboard'}
    >
      {isCopied ? (
        <>
          <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden="true" />
          <span>Copy Text</span>
        </>
      )}
    </Button>
  );
}
