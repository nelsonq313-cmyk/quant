import React, { useEffect, useMemo, useRef, useState } from 'react';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function rotatePoint(p, yaw, pitch){
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  const x1=p.x*cy-p.z*sy;
  const z1=p.x*sy+p.z*cy;
  const y1=p.y*cp-z1*sp;
  const z2=p.y*sp+z1*cp;
  return {x:x1,y:y1,z:z2};
}

export default function InteractiveSurface3D({surface,moneynessLevels}){
  const canvasRef=useRef(null);
  const dragRef=useRef(null);
  const [yaw,setYaw]=useState(-0.72);
  const [pitch,setPitch]=useState(0.58);
  const [zoom,setZoom]=useState(1);

  const mesh=useMemo(()=>{
    const rows=surface?.rows||[];
    const vals=rows.flat().map(p=>Number(p.iv)||0).filter(v=>v>0);
    const min=Math.min(...vals,0.15), max=Math.max(...vals,0.45), span=max-min||1;
    const points=rows.map((row,xi)=>row.map((p,yi)=>({
      x:(xi-(rows.length-1)/2)*1.25,
      y:-((Number(p.iv)||min)-min)/span*2.35,
      z:(yi-(row.length-1)/2)*0.72,
      iv:Number(p.iv)||0,
    })));
    return {points,min,max};
  },[surface]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const rect=canvas.getBoundingClientRect();
    canvas.width=Math.max(1,Math.round(rect.width*dpr));
    canvas.height=Math.max(1,Math.round(rect.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=rect.width,h=rect.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#07080b';ctx.fillRect(0,0,w,h);

    const project=(p)=>{
      const r=rotatePoint(p,yaw,pitch);
      const depth=8+r.z;
      const scale=(135*zoom)/Math.max(3.8,depth);
      return {x:w/2+r.x*scale,y:h/2+r.y*scale+18,z:r.z,scale};
    };

    ctx.strokeStyle='rgba(126,132,143,.14)';ctx.lineWidth=1;
    for(let i=0;i<8;i++){
      const y=h*.18+i*(h*.62/7);ctx.beginPath();ctx.moveTo(w*.08,y);ctx.lineTo(w*.94,y);ctx.stroke();
    }

    const faces=[];
    for(let x=0;x<mesh.points.length-1;x++){
      for(let z=0;z<(mesh.points[x]?.length||0)-1;z++){
        const raw=[mesh.points[x][z],mesh.points[x+1][z],mesh.points[x+1][z+1],mesh.points[x][z+1]];
        const pts=raw.map(project);
        faces.push({pts,depth:pts.reduce((s,p)=>s+p.z,0)/4,iv:raw.reduce((s,p)=>s+p.iv,0)/4});
      }
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces){
      const t=clamp((face.iv-mesh.min)/(mesh.max-mesh.min||1),0,1);
      const hue=275-t*70;
      ctx.beginPath();ctx.moveTo(face.pts[0].x,face.pts[0].y);for(let i=1;i<face.pts.length;i++)ctx.lineTo(face.pts[i].x,face.pts[i].y);ctx.closePath();
      ctx.fillStyle=`hsla(${hue},72%,${34+t*22}%,.78)`;ctx.fill();
      ctx.strokeStyle='rgba(209,199,255,.23)';ctx.stroke();
    }

    ctx.fillStyle='#747a84';ctx.font='10px ui-monospace, monospace';
    ctx.fillText('IV',14,19);ctx.fillText('DTE →',w-55,h-14);ctx.fillText('MONEYNESS',12,h-14);
    ctx.fillStyle='#555b64';ctx.font='9px ui-monospace, monospace';
    if(surface?.dtes?.length)ctx.fillText(`${surface.dtes[0]}d`,w*.60,h-32);
    if(surface?.dtes?.length)ctx.fillText(`${surface.dtes.at(-1)}d`,w*.82,h-57);
    if(moneynessLevels?.length){ctx.fillText(`${Math.round(moneynessLevels[0]*100)}%`,w*.10,h-44);ctx.fillText(`${Math.round(moneynessLevels.at(-1)*100)}%`,w*.25,h-86);}
  },[mesh,yaw,pitch,zoom,surface,moneynessLevels]);

  const down=(e)=>{dragRef.current={x:e.clientX,y:e.clientY,yaw,pitch};canvasRef.current?.setPointerCapture?.(e.pointerId)};
  const move=(e)=>{if(!dragRef.current)return;const d=dragRef.current;setYaw(d.yaw+(e.clientX-d.x)*.008);setPitch(clamp(d.pitch+(e.clientY-d.y)*.008,-.15,1.15));};
  const up=()=>{dragRef.current=null};
  const wheel=(e)=>{e.preventDefault();setZoom(v=>clamp(v*(e.deltaY>0?.92:1.08),.65,1.8));};

  return <div className="interactive3dWrap">
    <canvas ref={canvasRef} className="interactive3d" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}/>
    <div className="interactive3dHint">drag to rotate · wheel to zoom</div>
  </div>;
}