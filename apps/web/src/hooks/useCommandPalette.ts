import { useState, useEffect, useCallback } from 'react';

interface UseCommandPaletteReturn {
  visible: boolean;
  open: () => void;
  close: () => void;
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setVisible((v) => !v);
      }
      if ((e.key === 'Escape' || e.key === 'esc') && visible) {
        close();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, close]);

  return { visible, open, close };
}
