import { createRoot } from 'react-dom/client';
import Home from './app/page';
import './app/globals.css';
import './app/openlawtw.css';
import './app/rulings.css';
import './app/v08.css';
import './app/v09.css';
const snapshot=document.getElementById('openlawtw-law-snapshot');
if(snapshot){try{window.OPENLAWTW_PAGE_LAW=JSON.parse(snapshot.textContent||'null');}catch{}snapshot.remove();}
createRoot(document.getElementById('root')!).render(<Home/>);

import './app/v11.css';

import './app/v12.css';

import './app/universe.css';
