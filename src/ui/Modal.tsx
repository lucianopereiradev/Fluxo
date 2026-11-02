import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, IconButton } from './primitives';

/**
 * Accessible modal built on the native <dialog>: focus is trapped, Esc closes it and the
 * page behind becomes inert. On small screens it docks to the bottom like a sheet.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const { t } = useTranslation();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (initialFocusRef?.current) initialFocusRef.current.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  if (!open) return null;

  return (
    // Clicking the backdrop closes the dialog; keyboard users close it with Esc (onCancel).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'animate-rise text-text m-0 mt-auto w-full max-w-none overflow-visible bg-transparent p-0 sm:m-auto',
        size === 'sm' && 'sm:max-w-md',
        size === 'md' && 'sm:max-w-lg',
        size === 'lg' && 'sm:max-w-2xl',
      )}
    >
      <div className="border-border bg-surface shadow-soft flex max-h-[92dvh] flex-col rounded-t-2xl border sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl font-medium">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-muted mt-1 text-sm">
                {description}
              </p>
            )}
          </div>
          <IconButton label={t('common.close')} size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </header>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <footer className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
