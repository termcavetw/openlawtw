import type {BeforeSendEvent} from '@vercel/analytics/react';

export const ANALYTICS_ORIGIN = 'https://openlawtw.vercel.app';

// Only the public production site participates. Portable exports, preview
// deployments and local development must never send visitor data.
export function analyticsEnabled(origin:string, portable:boolean, online:boolean):boolean {
 return origin===ANALYTICS_ORIGIN && !portable && online;
}

export function sanitizeAnalyticsEvent(event:BeforeSendEvent, publicPaths:ReadonlySet<string>):BeforeSendEvent|null {
 if(event.type!=='pageview')return null;
 try {
  const url=new URL(event.url);
  if(url.origin!==ANALYTICS_ORIGIN || !publicPaths.has(url.pathname))return null;
  // Do not forward query strings, hash searches, article positions or any
  // additional properties. Casebook, notes and search state stay local.
  return {type:'pageview',url:url.origin+url.pathname};
 } catch {return null;}
}
