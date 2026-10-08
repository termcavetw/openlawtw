// Deliberately separate from the offline app shell. Loaded only online on the
// canonical production origin; never needed by the standalone HTML export.
export {Analytics as default} from '@vercel/analytics/react';
