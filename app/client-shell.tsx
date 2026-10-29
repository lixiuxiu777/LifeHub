'use client';
import { useEffect } from 'react';
import { shell } from './shell';
export default function ClientShell(){
  useEffect(()=>{if(!document.getElementById('lifehub-script')){const script=document.createElement('script');script.id='lifehub-script';script.type='module';script.src='/js/app.js';document.body.appendChild(script);}},[]);
  return <div dangerouslySetInnerHTML={{__html:shell}}/>;
}
