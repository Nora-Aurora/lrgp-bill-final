import React from 'react';
import Modal from './Modal';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonVariant?: 'primary' | 'destructive';
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  confirmButtonVariant = 'destructive',
}) => {
  if (!isOpen) return null;
  
  const confirmButtonClasses = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  }

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4 text-left">
        <h2 className="text-xl font-semibold" id="modal-title">{title}</h2>
        <div className="text-muted-foreground whitespace-pre-wrap">{message}</div>
        <div className="flex justify-end space-x-2 pt-4">
          <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md">
            {cancelButtonText}
          </button>
          <button type="button" onClick={onConfirm} className={`${confirmButtonClasses[confirmButtonVariant]} px-4 py-2 rounded-md`}>
            {confirmButtonText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationDialog;
