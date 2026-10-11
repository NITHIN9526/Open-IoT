import React,{useState,useEffect} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {BookOpen,ArrowUpRight} from 'lucide-react';
import {Modal} from './ui';
import { manualForPath } from "./manuals.js";
import './manuals.css';
export function ManualContent({manual:m}) {
 return <div className="manual-content"><p className="manual-intro">{m.intro}</p><h3>How to use</h3><ol>{m.steps.map(s=><li key={s}>{s}</li>)}</ol><div className="manual-example"><h3>Try this example</h3><p>{m.example}</p></div><h3>Things to know</h3><ul>{m.notes.map(s=><li key={s}>{s}</li>)}</ul><h3>Troubleshooting</h3>{m.trouble.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>;
}
export function TabManual() {
 const {pathname}=useLocation(),[open,setOpen]=useState(false),m=manualForPath(pathname);
 useEffect(()=>setOpen(false),[pathname]);
 return <><button className="btn btn-secondary btn-sm manual-help-button" onClick={()=>setOpen(true)}><BookOpen size={16}/>How to use</button>{open&&<Modal title={m.title+' manual'} onClose={()=>setOpen(false)}><ManualContent manual={m}/><Link className="btn btn-secondary manual-full-link" to={'/docs?tab='+m.id}><ArrowUpRight size={16}/>Open full manual</Link></Modal>}</>;
}
