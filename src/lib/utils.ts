export const DEFAULT_AVATAR = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI0UyRThGMCIvPjxwYXRoIGQ9Ik0zMiAzNkMzOC42Mjc0IDM2IDQ0IDMwLjYyNzQgNDQgMjRDNDQgMTcuMzcyNiAzOC42Mjc0IDEyIDMyIDEyQzI1LjM3MjYgMTIgMjAgMTcuMzcyNiAyMCAyNEMyMCAzMC42Mjc0IDI1LjM3MjYgMzYgMzIgMzZaIiBmaWxsPSIjOTRBM0I4Ii8+PHBhdGggZD0iTTUyIDUyLjQxNzRDNTIgNDQuNDU0NyA0My4wNDU3IDM4IDMyIDM4QzIwLjk1NDMgMzggMTIgNDQuNDU0NyAxMiA1Mi40MTc0QzEyIDUzLjI5MTUgMTIuNzA4NSA1NCAxMy41ODI2IDU0SDUwLjQxNzRDNTEuMjkxNSA1NCA1MiA1My4yOTE1IDUyIDUyLjQxNzRaIiBmaWxsPSIjOTRBM0I4Ii8+PC9zdmc+`;

/**
 * Validates and returns a proper avatar URL, or a default 👤 SVG fallback.
 * Prevents broken images from invalid strings like "text/plain".
 */
export const getAvatarUrl = (url: string | null | undefined): string => {
    if (!url) return DEFAULT_AVATAR;

    // Check if it's a valid URL or data URI, and not a placeholder like "text/plain"
    const isValid = (url.startsWith('http') || url.startsWith('data:image/')) && url.length > 10;

    if (!isValid) return DEFAULT_AVATAR;

    return url;
};
