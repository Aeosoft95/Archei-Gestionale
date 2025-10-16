'use client'
import { useEffect } from 'react'
export default function LegacyClockRedirect(){
  useEffect(()=>{
    const role = localStorage.getItem('archei:role')
    window.location.href = role === 'gm' ? '/gm/clock' : '/'
  },[])
  return null
}
