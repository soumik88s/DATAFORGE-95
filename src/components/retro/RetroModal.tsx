import React, { useEffect } from 'react';
import { RetroWindow } from './RetroWindow.js';
import { BevelButton } from './BevelButton.js';
import { playRetroError } from '../../utils/audio.js';

interface RetroModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  icon?: string;
  footer?: React.ReactNode;
  isError?: boolean;
}

export const RetroModal: React.FC<RetroModalProps> = ({
  isOpen,
  title,
  onClose,
  children,
  icon = '💾',
  footer,
  isError = false
}) => {
  useEffect(() => {
    if (isOpen && isError) {
      playRetroError();
    }
  }, [isOpen, isError]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-none"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <RetroWindow
        title={title}
        icon={icon}
        onClose={onClose}
        className="w-full max-w-lg shadow-[4px_4px_0px_#000000]"
      >
        <div className="py-2">{children}</div>

        <div className="groove-hr my-3"></div>

        <div className="flex justify-end gap-2">
          {footer ? (
            footer
          ) : (
            <BevelButton onClick={onClose} variant="primary" className="min-w-[80px]">
              OK
            </BevelButton>
          )}
        </div>
      </RetroWindow>
    </div>
  );
};
