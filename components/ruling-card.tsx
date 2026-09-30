import type {Ruling} from '@/lib/law-types';
import {RulingPreview} from './ruling-preview';

export function RulingCard({ruling,onClick,selected=false}:{ruling:Ruling;onClick:()=>void;selected?:boolean}){
 return <button type="button" className={'ruling-card '+(selected?'selected':'')} onClick={onClick}><div className="result-meta"><span>{ruling.topic}</span><span>{ruling.date||'發文日待核對'}</span></div><h3>{ruling.title}</h3><div className="number">{ruling.number||'字號待核對'}</div>{ruling.status==='mentioned'&&<small className="ruling-status">內文含停止適用／廢止等註記</small>}<RulingPreview key={ruling.id} ruling={ruling}/></button>;
}
