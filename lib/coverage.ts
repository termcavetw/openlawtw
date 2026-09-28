import type {Law} from './law-types.ts';
// Editorial title matching only. A topic with no matches is an identified gap,
// never a statement that the jurisdiction has no such regulation.
export const coverageTopics=[
 {id:'management',name:'建築管理',description:'地方建築管理自治條例及規則',pattern:/建築管理/},
 {id:'small-lots',name:'畸零地',description:'畸零地合併、使用與調處',pattern:/畸零地/},
 {id:'arcade',name:'騎樓',description:'騎樓設置、使用與整平',pattern:/騎樓/},
 {id:'exempt-permit',name:'免辦建照',description:'免建築執照及一定規模工作物',pattern:/免.*(?:建築|建造|雜項|建照)|一定規模/},
 {id:'interior',name:'室內裝修',description:'室內裝修申請、審查與簡化',pattern:/室內裝修/},
 {id:'change-use',name:'變更使用',description:'使用變更及免辦變更使用',pattern:/變更使用/},
 {id:'setbacks',name:'退縮與留設空間',description:'退縮、空地及開放空間',pattern:/退縮|退讓|空地|開放空間/},
 {id:'accessibility',name:'無障礙',description:'無障礙設施及替代改善',pattern:/無障礙/},
] as const;
export function regionCoverage(laws:Law[],region:string){
 const records=laws.filter(l=>l.region===region);
 return {records,full:records.filter(l=>l.coverage==='full'),links:records.filter(l=>l.coverage==='link'),topics:coverageTopics.map(topic=>({...topic,laws:records.filter(l=>topic.pattern.test(l.name))}))};
}
export function captureDate(law:Law){return law.retrieved?.split('T')[0]||'';}
