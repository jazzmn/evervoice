'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { callExternalService } from '@/lib/tauri-api';
import { cn } from '@/lib/utils';

/**
 * Props for the CustomActionButton component
 */
export interface CustomActionButtonProps {
  /** The display name for the button */
  name: string;
  /** The URL endpoint to POST the transcription to */
  url: string;
  /** The transcription text to send */
  transcription: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Button component that posts transcription text to a custom external service.
 *
 * - POSTs transcription as JSON to configured URL
 * - Shows per-button loading state during request
 * - Displays toast notifications for success/error states
 */
export function CustomActionButton({
  name,
  url,
  transcription,
  disabled = false,
  className,
}: CustomActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    if (!transcription || isLoading) return;

    setIsLoading(true);

    try {
      const response = await callExternalService(url, transcription);

      if (response.success) {
        toast({
          title: `${name} completed`,
          description: response.message ?? 'Action completed successfully.',
          variant: 'success',
        });
      } else {
        toast({
          title: `${name} failed`,
          description: response.message ?? 'The action could not be completed.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to call external service';
      toast({
        title: `${name} failed`,
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || isLoading || !transcription}
      className={cn('gap-2', className)}
      data-testid={`custom-action-button-${name.toLowerCase().replace(/\s+/g, '-')}`}
      aria-label={isLoading ? `Running ${name}` : name}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Running...</span>
        </>
      ) : (
        <>
          <Send className="h-4 w-4" aria-hidden="true" />
          <span>{name}</span>
        </>
      )}
    </Button>
  );
}
