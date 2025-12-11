import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts various Vimeo URL formats to embeddable player URLs
 * Handles: vimeo.com/123456789, vimeo.com/123456789/abc123 (private with hash)
 */
export function getVimeoEmbedUrl(url: string): string {
  if (!url || !url.includes('vimeo.com')) return url;
  
  // Already an embed URL
  if (url.includes('player.vimeo.com')) return url;
  
  // Extract video ID and optional hash from URL
  // Format: vimeo.com/VIDEO_ID or vimeo.com/VIDEO_ID/HASH
  const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  
  if (!match) return url;
  
  const videoId = match[1];
  const hash = match[2];
  
  let embedUrl = `https://player.vimeo.com/video/${videoId}`;
  
  // Add hash parameter for private videos
  if (hash) {
    embedUrl += `?h=${hash}`;
  }
  
  // Add player options
  const separator = hash ? '&' : '?';
  embedUrl += `${separator}autoplay=0&title=0&byline=0&portrait=0`;
  
  return embedUrl;
}
