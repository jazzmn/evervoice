'use client';

import * as React from 'react';
import { Settings, Eye, EyeOff, Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsStore } from '@/stores/settings-store';
import { CustomActionForm } from '@/components/custom-action-form';
import { CustomActionListItem } from '@/components/custom-action-list-item';
import { FlagIcon } from '@/components/flag-icon';
import { HotkeyInput } from '@/components/settings/hotkey-input';
import { SUPPORTED_LANGUAGES, DEFAULT_GLOBAL_HOTKEY, type LanguageCode } from '@/types/settings';

/**
 * Settings dialog component for configuring recording settings.
 * Includes max duration, API key fields, hotkey configuration, and custom actions management.
 */
export function SettingsDialog() {
  const [open, setOpen] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [hotkeyError, setHotkeyError] = React.useState<string | null>(null);
  const [showAddActionForm, setShowAddActionForm] = React.useState(false);

  // Form state for editing (separate from store to allow cancel)
  const [formDuration, setFormDuration] = React.useState('');
  const [formApiKey, setFormApiKey] = React.useState('');
  const [formLanguage, setFormLanguage] = React.useState<LanguageCode>('de');
  const [formHotkey, setFormHotkey] = React.useState('');

  const {
    settings,
    isSaving,
    updateSettings,
    setGlobalHotkey,
    addCustomAction,
    removeCustomAction,
    error: storeError,
    clearError,
  } = useSettingsStore();

  // Sync form state with store when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormDuration(settings.maxDuration.toString());
      setFormApiKey(settings.apiKey ?? '');
      setFormLanguage(settings.language);
      setFormHotkey(settings.globalHotkey ?? DEFAULT_GLOBAL_HOTKEY);
      setValidationError(null);
      setHotkeyError(null);
      setShowApiKey(false);
      setShowAddActionForm(false);
      clearError();
    }
  }, [open, settings, clearError]);

  /**
   * Validate and save settings
   */
  const handleSave = async () => {
    // Validate duration
    const duration = parseInt(formDuration, 10);

    if (isNaN(duration) || duration <= 0) {
      setValidationError('Max duration must be greater than 0');
      return;
    }

    if (duration > 180) {
      setValidationError('Max duration cannot exceed 180 minutes');
      return;
    }

    setValidationError(null);
    setHotkeyError(null);

    // Check if hotkey changed and update it
    const currentHotkey = settings.globalHotkey ?? DEFAULT_GLOBAL_HOTKEY;
    if (formHotkey !== currentHotkey) {
      const hotkeyResult = await setGlobalHotkey(
        formHotkey === DEFAULT_GLOBAL_HOTKEY ? null : formHotkey
      );

      if (!hotkeyResult.success) {
        setHotkeyError(hotkeyResult.error || 'Failed to update hotkey');
        return;
      }
    }

    // Update other settings
    await updateSettings({
      maxDuration: duration,
      apiKey: formApiKey.trim() || null,
      language: formLanguage,
    });

    // Close dialog on success (if no store error occurred)
    if (!useSettingsStore.getState().error) {
      setOpen(false);
    }
  };

  /**
   * Handle cancel - close without saving
   */
  const handleCancel = () => {
    setOpen(false);
  };

  /**
   * Toggle API key visibility
   */
  const toggleApiKeyVisibility = () => {
    setShowApiKey((prev) => !prev);
  };

  /**
   * Handle adding a new custom action
   */
  const handleAddAction = async (name: string, url: string) => {
    await addCustomAction(name, url);
    setShowAddActionForm(false);
  };

  /**
   * Handle removing a custom action
   */
  const handleRemoveAction = async (id: string) => {
    await removeCustomAction(id);
  };

  const displayError = validationError || storeError;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your recording settings. Changes are saved locally.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="grid gap-4 py-4"
        >
          {/* Max Duration Field */}
          <div className="grid gap-2">
            <Label htmlFor="max-duration">Max Recording Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                id="max-duration"
                type="number"
                min="1"
                max="180"
                value={formDuration}
                onChange={(e) => {
                  setFormDuration(e.target.value);
                  setValidationError(null);
                }}
                placeholder="30"
                className="flex-1"
                aria-describedby={displayError ? 'duration-error' : undefined}
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                minutes
              </span>
            </div>
            {displayError && (
              <p
                id="duration-error"
                className="text-sm text-red-500 dark:text-red-400"
                role="alert"
              >
                {displayError}
              </p>
            )}
          </div>

          {/* API Key Field */}
          <div className="grid gap-2">
            <Label htmlFor="api-key">OpenAI API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleApiKeyVisibility}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Required for transcription. Get your key from OpenAI.
            </p>
          </div>

          {/* Language Field */}
          <div className="grid gap-2">
            <Label htmlFor="language">Transcription Language</Label>
            <Select
              value={formLanguage}
              onValueChange={(value: string) => setFormLanguage(value as LanguageCode)}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <FlagIcon languageCode={lang.code} />
                      <span>{lang.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Language used for speech recognition.
            </p>
          </div>

          {/* Global Hotkey Field */}
          <HotkeyInput
            id="global-hotkey"
            value={formHotkey}
            onChange={setFormHotkey}
            error={hotkeyError}
            disabled={isSaving}
          />
        </form>

        {/* Custom Actions Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Custom Actions (send transcript to webhook)</h3>
            {!showAddActionForm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddActionForm(true)}
                aria-label="Add custom action"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Action
              </Button>
            )}
          </div>

          {/* Add Action Form */}
          {showAddActionForm && (
            <div className="mb-3">
              <CustomActionForm
                onSubmit={handleAddAction}
                onCancel={() => setShowAddActionForm(false)}
              />
            </div>
          )}

          {/* Custom Actions List */}
          {settings.customActions.length > 0 ? (
            <div className="space-y-2">
              {settings.customActions.map((action) => (
                <CustomActionListItem
                  key={action.id}
                  action={action}
                  onDelete={handleRemoveAction}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
              No custom actions configured. Add an action to send transcriptions to external services.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
