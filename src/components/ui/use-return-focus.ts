"use client";

import * as React from "react";

type AutoFocusHandler = (event: Event) => void;

/**
 * Rend le focus à l'élément qui l'avait à l'ouverture d'un overlay Radix.
 *
 * Radix ne rend le focus qu'à son `Trigger` : un dialogue ouvert par un état
 * (bouton hors du `Root`, hook, liste) laissait le focus sur `<body>`.
 * Un `onCloseAutoFocus` de l'appelant qui appelle `preventDefault()` garde la main
 * (repli quand l'ouvreur a disparu).
 */
export function useReturnFocus(handlers: {
  onOpenAutoFocus?: AutoFocusHandler;
  onCloseAutoFocus?: AutoFocusHandler;
}): { onOpenAutoFocus: AutoFocusHandler; onCloseAutoFocus: AutoFocusHandler } {
  const openerRef = React.useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: (event) => {
      const active = document.activeElement;
      // <body> n'est pas un ouvreur : le « rendre » empêcherait Radix de focaliser un Trigger
      // présent (Safari ne focalise pas un bouton cliqué).
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      handlers.onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event) => {
      handlers.onCloseAutoFocus?.(event);
      const opener = openerRef.current;
      openerRef.current = null;
      if (!event.defaultPrevented && opener?.isConnected) {
        event.preventDefault();
        opener.focus();
      }
    },
  };
}
