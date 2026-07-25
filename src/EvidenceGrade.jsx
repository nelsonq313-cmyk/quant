import React from 'react';

export function getEvidenceGrade({sampleSize,intervalWidth,tailStressPositive,curated}){
  const depth=sampleSize>=100?25:sampleSize>=60?22:sampleSize>=40?18:sampleSize>=30?15:sampleSize>=20?12:8;
  const precision=intervalWidth<=15?25:intervalWidth<=20?22:intervalWidth<=25?18:intervalWidth<=30?15:intervalWidth<=35?12:8;
  const robustness=tailStressPositive?25:10;
  const integrity=curated?8:25;
  const score=depth+precision+robustness+integrity;
  const letter=score>=85?'A':score>=70?'B':score>=55?'C':score>=40?'D':'F';
  return{letter,score,depth,precision,robustness,integrity};
}

export default function EvidenceGrade({grade}){
  return <div className="qvGrade"><strong>{grade.letter}</strong><span>{grade.score}/100</span><small>EVIDENCE</small></div>;
}
