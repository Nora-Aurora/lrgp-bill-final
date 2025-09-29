import React from 'react';
import { XIcon } from './icons';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-lg shadow-xl p-6 w-full max-w-5xl mx-4 relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()} // Prevent click inside from closing modal
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close modal"
        >
          <XIcon />
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;