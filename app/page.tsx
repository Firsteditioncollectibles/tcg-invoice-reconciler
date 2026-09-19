'use client';
import {useState} from 'react';
type Row={id:number,description:string,details:string,price:number,qty:number};
const seed:Row[]=[{id:1,description:'Example Pokemon Card',details:'Near Mint',price:5.88,qty:1}];
export default function Home(){
 const [rows,setRows]=useState(seed);
 const subtotal=rows.reduce((s,r)=>s+r.price*r.qty,0);
 const update=(id:number,k:keyof Row,v:string)=>setRows(rows.map(r=>r.id===id?{...r,[k]:k==='price'||k==='qty'?Number(v):v}:r));
 return <main><header><h1>TCG Invoice Reconciler</h1><p>TCGplayer order - reconcile received contents - export</p></header>
 <section className="upload"><h2>1. Import TCGplayer order</h2><input type="file" accept="image/*,.pdf"/><p>Scanner extraction is the next build milestone. The editor below is live.</p></section>
 <section><h2>2. Reconcile line items</h2>{rows.map(r=><div className="row" key={r.id}><input value={r.description} onChange={e=>update(r.id,'description',e.target.value)}/><input value={r.details} onChange={e=>update(r.id,'details',e.target.value)}/><input type="number" step=".01" value={r.price} onChange={e=>update(r.id,'price',e.target.value)}/><input type="number" min="1" value={r.qty} onChange={e=>update(r.id,'qty',e.target.value)}/><button onClick={()=>setRows(rows.filter(x=>x.id!==r.id))}>Delete</button></div>)}<button onClick={()=>setRows([...rows,{id:Date.now(),description:'Pokemon trading cards',details:'',price:0,qty:1}])}>+ Add line</button><div className="total">Subtotal: ${subtotal.toFixed(2)}</div></section>
 <section><h2>3. Output</h2><button onClick={()=>window.print()}>Save / Print PDF</button><p className="note">Generated output is a reconciled shipment document, not a seller-issued replacement invoice.</p></section></main>
}