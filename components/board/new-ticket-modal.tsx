'use client';

import * as React from 'react';
import { CreateTicketSchema, type CreateTicketInput } from '@/lib/validations/ticket';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated?: () => void;
}

interface FormErrors {
  title?: string;
  description?: string;
  submit?: string;
}

/**
 * NewTicketModal Component (Client Component)
 * Modal dialog for creating new tickets with form validation
 * - Real-time validation with Zod schema
 * - Loading states during API submission
 * - Error handling with field-specific messages
 * - Keyboard navigation support (Escape, Enter)
 */
export function NewTicketModal({
  open,
  onOpenChange,
  onTicketCreated,
}: NewTicketModalProps) {
  const [formData, setFormData] = React.useState<CreateTicketInput>({
    title: '',
    description: '',
  });
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      setFormData({ title: '', description: '' });
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  // Validate a single field
  const validateField = (field: keyof CreateTicketInput, value: string) => {
    try {
      CreateTicketSchema.shape[field].parse(value);
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (error) {
      if (error && typeof error === 'object' && 'errors' in error) {
        const zodError = error as { errors: Array<{ message: string }> };
        setErrors((prev) => ({
          ...prev,
          [field]: zodError.errors[0]?.message || 'Invalid input',
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          [field]: 'Invalid input',
        }));
      }
    }
  };

  // Handle field change with validation
  const handleFieldChange = (field: keyof CreateTicketInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  // Check if form is valid
  const isFormValid = React.useMemo(() => {
    const result = CreateTicketSchema.safeParse(formData);
    return result.success && !errors.title && !errors.description;
  }, [formData, errors]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation before submit
    const result = CreateTicketSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof CreateTicketInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json();
          const fieldErrors: FormErrors = {};
          if (errorData.details?.fieldErrors) {
            Object.entries(errorData.details.fieldErrors).forEach(
              ([field, messages]) => {
                const message = Array.isArray(messages) ? messages[0] : messages;
                if (typeof message === 'string') {
                  fieldErrors[field as keyof CreateTicketInput] = message;
                }
              }
            );
          }
          setErrors(fieldErrors);
        } else {
          setErrors({
            submit: 'Unable to create ticket. Please try again.',
          });
        }
        return;
      }

      // Success - close modal and notify parent
      onOpenChange(false);
      onTicketCreated?.();
    } catch (error) {
      console.error('Error creating ticket:', error);
      setErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Field */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter ticket title (max 100 characters)"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              onBlur={(e) => validateField('title', e.target.value)}
              disabled={isSubmitting}
              className={errors.title ? 'border-red-500' : ''}
              autoFocus
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.title.length}/100 characters
            </p>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter ticket description (max 1000 characters)"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              onBlur={(e) => validateField('description', e.target.value)}
              disabled={isSubmitting}
              className={errors.description ? 'border-red-500' : ''}
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/1000 characters
            </p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.submit}
              </p>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
