import raw from '../data/runtime-catalog.json' with {type:'json'};
import type {Catalog} from './law-types';
export const data=raw as unknown as Catalog;
export const lawById=new Map(data.laws.map(l=>[l.id,l]));
