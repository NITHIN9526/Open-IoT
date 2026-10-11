import React,{useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Search,BookOpen,Printer} from 'lucide-react';
import {Logo,Footer} from './ui';
import { manuals } from "./manuals.js";
import { ManualContent } from "./Manuals.jsx";
import './manuals.css';
export function Docs(){
 const [params,setParams]=useSearchParams(),[query,setQuery]=useState('');
 const selected=manuals.find(m=>m.id===params.get('tab'))??manuals[0];
 const results=query.trim()?manuals.filter(m=>JSON.stringify(m).toLowerCase().includes(query.trim().toLowerCase())):[selected];
 return <><nav className="page-width nav manual-nav"><Logo/><Link className="btn btn-sm" to="/dashboard">Open dashboard</Link></nav><main className="manual-page page-width"><header className="manual-hero"><div className="eyebrow">OPEN IOT / USER MANUAL</div><h1>A guide for every tab.</h1><p>Follow the steps, try an example, and understand each result.</p><label className="manual-search"><Search size={19}/><input aria-label="Search manuals" type="search" placeholder="Search: token, phone, scene, cooldown…" value={query} onChange={e=>setQuery(e.target.value)}/></label></header><div className="manual-layout"><aside className="manual-topics" aria-label="Manual topics">{manuals.map(m=><button key={m.id} aria-current={!query&&m.id===selected.id?'page':undefined} onClick={()=>{setQuery('');setParams({tab:m.id});}}><BookOpen size={15}/>{m.title}</button>)}</aside><section className="manual-reading" aria-live="polite">{query&&<p className="manual-results">{results.length} matching {results.length===1?'topic':'topics'}</p>}{!results.length&&<p>No matching topics. Try “power”, “timezone” or “offline”.</p>}{results.map(m=><article key={m.id}><div className="manual-title"><h2>{m.title}</h2><button className="icon-btn manual-print" aria-label="Print visible manuals" onClick={()=>window.print()}><Printer size={19}/></button></div><ManualContent manual={m}/>{m.id!=='start'&&<Link className="btn btn-secondary manual-full-link" to={m.path}>Open {m.id==='control'||m.id==='support'?'Devices':m.title}</Link>}</article>)}</section></div></main><Footer/></>;
}
