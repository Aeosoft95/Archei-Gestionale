
'use client'
export default function DicePreview({ rolls, threshold }:{ rolls:number[], threshold:number }){
  return (
    <div className="flex gap-2">
      {rolls?.map((v,i)=>(
        <div key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center border ${v>=threshold?'border-green-500 text-green-400':'border-zinc-700 text-zinc-300'} bg-zinc-900`}>
          {v}
        </div>
      ))}
    </div>
  )
}
