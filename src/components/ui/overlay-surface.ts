/*
 * Surface centrée commune à Dialog et AlertDialog. Le centrage passe par la mise en page
 * (inset-0 + m-auto + h-fit) et non par un translate : les animations d'entrée et de sortie
 * de tailwindcss-animate pilotent la propriété transform, qui ne doit donc pas porter la position.
 * Chaque dialogue n'ajoute que sa largeur maximale et son espacement intérieur.
 */
export const CENTERED_SURFACE_CLASSES = [
  "fixed inset-0 z-50 m-auto h-fit w-[calc(100%-2rem)]",
  "max-h-[90dvh] overflow-y-auto rounded-card bg-card text-card-foreground shadow-lg",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
  "data-[state=open]:duration-200 data-[state=closed]:duration-150",
].join(" ");
