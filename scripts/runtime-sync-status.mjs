// The full report retains audit fingerprints and source provenance. The app
// shell needs only presentation fields; do not duplicate raw audit evidence.
export function runtimeSyncStatus(status){
 if(!status)return undefined;
 return {attemptedAt:status.attemptedAt,summary:status.summary,outcomes:status.outcomes.map(({id,name,status,attemptedAt,lastSuccessfulFetch,reason})=>({id,name,status,attemptedAt,lastSuccessfulFetch,...(reason?{reason}:{})}))};
}
