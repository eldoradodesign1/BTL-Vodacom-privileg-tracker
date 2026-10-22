/** URL d'un fichier du dossier `public/`, valable à la racine comme sous un dossier de publication (GitHub Pages). */
export const publicUrl = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
