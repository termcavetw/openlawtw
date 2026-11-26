// Taoyuan-only material (土管要點, minutes): one lazy chunk, kept out of the initial offline shell.
// Its styles travel with it (injected once) so they do not count against the 3 MiB shell either.
import css from './regional.css?inline';
if(typeof document!=='undefined'&&!document.getElementById('openlawtw-regional-css')){const style=document.createElement('style');style.id='openlawtw-regional-css';style.textContent=css;document.head.appendChild(style);}
export {MinutesExplorer} from './minutes';
export {LanduseExplorer,RegionalHits} from './landuse';
export {AgriExplorer} from './agri';
export {TaipeiExplorer} from './taipei';
export {NtpcExplorer} from './ntpc';
export {LandExplorer} from './land';
export {CentralExplorer} from './central';
export {NfaExplorer} from './nfa';
