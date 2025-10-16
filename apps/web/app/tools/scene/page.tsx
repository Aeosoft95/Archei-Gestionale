'use client'
import { useEffect } from 'react'
export default function LegacySceneRedirect(){
  useEffect(()=>{
    const role = localStorage.getItem('archei:role')
    window.location.href = role === 'gm' ? '/gm/scene' : '/'
  },[])
  return null
}
